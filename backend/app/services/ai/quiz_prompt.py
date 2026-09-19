"""Dựng prompt và kiểm tra kết quả LLM trả về.

Thuần: không chạm DB, không gọi mạng. Mọi thứ model trả ra đi qua
`parse_and_validate` trước khi tới database — đây là ranh giới tin cậy của
tính năng, nên phần kiểm tra ở đây cố tình chi tiết và bảo thủ.
"""
import json
import re
from collections.abc import Callable, Sequence
from random import Random
from typing import Any

from app.services.quiz_generator import AI_QUESTION_TYPES, GeneratedQuestion, _normalize

CLOZE_BLANK = "___"
MIN_OPTION_COUNT = 2
MAX_OPTION_COUNT = 4

# Dạng nào có số phương án cố định thì khai ở đây. Dạng vắng mặt tự ép số
# phương án trong checker của nó.
OPTION_COUNT: dict[str, int] = {
    "cloze": 4,
    "context": 4,
    "verb_tense": 4,
}

# Dấu trọng âm IPA: xuất hiện trong prompt_text là lộ đáp án, nhưng lại là
# yêu cầu bắt buộc trong explanation (chỉ hiện sau khi người học đã trả lời).
PRIMARY_STRESS_MARK = "ˈ"
STRESS_MARKS = (PRIMARY_STRESS_MARK, "ˌ")
STRESS_OPTION_RE = re.compile(r"^(\d+) — (.+)$")

# Model hay gõ dấu trọng âm bằng dấu nháy thường (') hoặc dấu nháy kiểu chữ
# (') thay vì đúng ký tự IPA ˈ, vì bàn phím/dữ liệu huấn luyện phổ biến dùng
# vậy. Chấp nhận các biến thể này, nhưng chỉ khi nằm trong một cặp dấu gạch
# chéo /.../ — để phân biệt với dấu nháy đơn xuất hiện tình cờ trong câu văn
# (ví dụ "it's").
IPA_TRANSCRIPTION_RE = re.compile(r"/[^/\n]*['ˈʼ’´′][^/\n]*/")

SYSTEM_HEADER = """\
You are an experienced English teacher who writes multiple-choice vocabulary tests for Vietnamese learners at B1–B2 level.

You receive a list of vocabulary cards (each card has card_id, front_text, back_text, example, synonyms). Your task: write questions based ONLY on those cards."""

TYPE_RULES: dict[str, str] = {
    "cloze": """\
"cloze" — Fill in the blank
   • Write ONE natural English sentence of 10–20 words containing exactly one blank written as ___ (three underscores in a row, no more, no less).
   • The sentence must give enough clues that only ONE answer works; avoid sentences so generic that any option would fit.
   • The correct answer is the card's front_text.
   • If the card has an example field, do NOT copy that example sentence; write a new sentence in a different situation.
   • Exactly 4 options.""",
    "context": """\
"context" — Pick the word that fits the situation
   • Describe a specific situation in English (2–3 sentences), then ask which word fits best.
   • The situation must be detailed enough to clearly separate the correct answer from near-synonym options.
   • The correct answer is the card's front_text.
   • Exactly 4 options.""",
    "verb_tense": """\
"verb_tense" — Verb tense
   • Use ONLY cards whose front_text is a VERB. Skip non-verb cards entirely; never force a question out of them.
   • Write ONE English sentence of 12–25 words containing exactly one blank written as ___ (three underscores in a row), immediately followed by the base form of the verb in parentheses.
     Example: "By the time we arrived, the meeting ___ (finish) already."
   • The parentheses may contain ONLY the base verb written in letters — no digits, no punctuation.
   • The sentence MUST carry a clear time marker (by the time, since 2010, while, every morning, this time next year, ...) so that EXACTLY ONE tense is correct.
   • Exactly 4 options, all DIFFERENT conjugated forms of that SAME verb. Never switch to another verb.
   • The three wrong options must be tenses Vietnamese learners commonly confuse in this very sentence (for example present perfect vs past simple), not meaningless forms.
   • The explanation must state which time marker decides the correct tense.""",
    "word_stress": """\
"word_stress" — Word stress
   • Use ONLY cards whose front_text is a SINGLE word (one word, no spaces, no hyphens) with 2–4 syllables. Skip one-syllable words, words longer than 4 syllables, and multi-word phrases entirely.
   • prompt_text is that word EXACTLY as it is: lowercase, unbroken, with NO syllable split and NO stress mark (no ˈ, no ˌ), and not a single capital letter. Example: "comfortable".

   ▲ MOST IMPORTANT RULE — SPLIT BY SPELLING, NOT BY PRONUNCIATION ▲
   • options are the result of cutting prompt_text into consecutive chunks of letters. Joining all the chunks in order MUST reproduce prompt_text CHARACTER FOR CHARACTER: nothing added, nothing dropped, nothing changed, no letter rewritten.
   • This is a split of the WRITTEN form (like dictionary hyphenation: com·fort·a·ble), NOT a phonetic transcription. Many words swallow sounds, so the number of syllables you HEAR is smaller than the number of written chunks — ignore pronunciation and cut so that the chunks together hold every letter; silent letters still belong to a chunk.
     ─ "chocolate"   → ["1 — cho", "2 — co", "3 — late"]      (cho+co+late = chocolate), NOT ["choc","late"].
     ─ "comfortable" → ["1 — com", "2 — for", "3 — ta", "4 — ble"] (com+for+ta+ble = comfortable), NOT ["comf","ta","ble"].
     ─ "interesting" → ["1 — in", "2 — ter", "3 — est", "4 — ing"] (in+ter+est+ing = interesting).
     ─ "vegetable"   → ["1 — veg", "2 — e", "3 — ta", "4 — ble"]   (veg+e+ta+ble = vegetable).
     ─ "business"    → ["1 — busi", "2 — ness"]                    (busi+ness = business).
   • The number of options = the number of chunks you just cut (2, 3 or 4) — this is the only exception to the 4-option rule.
   • Option i has the form "i — chunk i", joined by " — " (em dash —, one space on each side), listed left to right in order.
   • NEVER capitalize any chunk, not even the stressed one (capitalizing gives the answer away). Every chunk is lowercase exactly as in prompt_text; only correct_index marks the right syllable. Do NOT put ˈ, ˌ or any phonetic character into options — options contain only letters taken straight from prompt_text.
   • correct_index points to the chunk holding the PRIMARY STRESS.
   • SELF-CHECK before answering: join the chunks in options (dropping the "i — " part); if the result differs from prompt_text by even one character, split again. If there is no way to split while keeping every letter, SKIP that card instead of forcing a question out of it.
   • Write the explanation in Vietnamese, and it MUST OPEN with a transcription in exactly this shape: a pair of slashes /.../, with a stress mark placed IMMEDIATELY BEFORE the primary-stressed syllable and INSIDE that pair of slashes.
     ─ The stress mark may ONLY be the IPA character ˈ (preferred) or a straight apostrophe ' if you cannot type ˈ. NEVER use an acute accent ´, a prime ′, a backtick ` or any other character — a wrong mark counts as missing.
     ─ The transcription must sit inside a / / pair, with no line break in the middle. No / / counts as missing.
     ─ If the stress falls on the first syllable, the mark still goes right after the opening /.
       Example: "/ˈkʌmftəbl/ ..." (stress on syllable 1) or "/kəmˈfɜːrtəbl/ ..." (stress on syllable 2). If you cannot type ˈ: "/'kʌmftəbl/" or "/kəm'fɜːrtəbl/".
     ─ SELF-CHECK before answering: the explanation must contain a stretch that starts with /, ends with /, and holds ˈ or ' between those two slashes. If not, rewrite the explanation.
   • Only after the transcription, state the stress rule that applies (for example: the suffix -able does not move the stress; words ending in -tion take the stress on the syllable right before it).""",
}

WORD_DISTRACTOR_RULES = """\
═══ DISTRACTOR RULES — for the cloze and context types ═══

- Every question has EXACTLY 4 options. No two options may be the same (not even with different capitalization).
- The three wrong options must:
  ─ Share the part of speech of the correct answer.
  ─ Be CLEARLY DIFFERENT IN MEANING from one another — never use two near-synonyms as distractors at the same time.
    Bad example:  answer "delighted", distractors ["happy", "glad", "joyful"] ← all three mean nearly the same.
    Good example: answer "delighted", distractors ["exhausted", "reluctant", "confused"] ← three different directions of meaning.
  ─ Look plausible on the surface (same topic or same frequency level) so the question is not too easy, yet be clearly wrong once the context is read carefully.
  ─ Never be taken from the card's synonyms field (a synonym could be correct too).
- The position of the correct answer (correct_index) should be spread evenly, not always 0."""

EXPLANATION_RULES = """\
═══ EXPLANATION RULES ═══

Write in Vietnamese, 2–4 sentences, structured as:
1. State the correct answer and explain WHY it fits there (through meaning or collocation).
2. Pick the 1–2 most tempting wrong options and briefly explain why they do not fit here.
Do not write vague lines like "the other options are wrong". Point out the specific problem."""

# Card_id thật là UUID4 (xem app.models.card.Card.id) — ví dụ này cho model
# thấy đúng hình dạng chuỗi cần sao chép, tránh nó tưởng "..." nghĩa là được
# tự bịa hoặc dùng front_text làm định danh.
_EXAMPLE_CARD_ID = "a1b2c3d4-5e6f-7890-abcd-ef1234567890"


def _technical_rules(ordered_types: Sequence[str]) -> str:
    """Ràng buộc kỹ thuật, với question_type liệt kê đích danh các dạng được yêu cầu.

    Liệt kê đích danh (thay vì nói chung chung "nằm trong danh sách yêu cầu")
    vì model hay bám vào ví dụ literal trong OUTPUT_FORMAT nếu không có gì cụ
    thể hơn để neo vào — xem lịch sử: khi chỉ yêu cầu verb_tense/word_stress,
    model từng trả về toàn "cloze" vì đó là chuỗi literal duy nhất nó thấy.
    Cùng lý do, card_id cũng nêu rõ hình dạng và cấm dùng front_text/back_text.
    """
    allowed = ", ".join(f'"{t}"' for t in ordered_types)
    return f"""\
═══ TECHNICAL CONSTRAINTS ═══

- The card_id of EVERY question MUST be exactly the "card_id" field of the matching card in the input data (a UUID-shaped string, for example "{_EXAMPLE_CARD_ID}") — copy it verbatim, never invent one, and NEVER use front_text or back_text as the card_id.
- Never use the same card_id for two questions.
- The question_type of EVERY question MUST be one of exactly these values: {allowed}. Use no other value, not even a question type the system really supports but that is absent from this list.
- correct_index is an integer from 0 to (number of options minus 1), pointing at the correct entry of the options array.
- No option may be empty or duplicated.
- The position of the correct answer should be spread evenly across questions, not always 0."""


def _output_format(ordered_types: Sequence[str]) -> str:
    """Ví dụ JSON, với question_type minh hoạ bằng MỘT dạng thật sự được yêu cầu.

    Trước đây ví dụ này hardcode "cloze" — khi cloze không nằm trong dạng
    được yêu cầu, đó là chuỗi "cloze" duy nhất còn sót trong cả prompt, và
    model bám vào nó thay vì dùng dạng thật. Tương tự, card_id từng là "..."
    — không cho model biết hình dạng thật của card_id — nên với các dạng
    xoay quanh một từ (verb_tense, word_stress), model từng trả front_text
    (ví dụ "refer") thay vì card_id thật.
    """
    example_type = ordered_types[0]
    return f"""\
═══ OUTPUT FORMAT ═══

Return ONLY one JSON object, with no markdown and no explanatory text around it:
{{"questions": [{{"card_id": "{_EXAMPLE_CARD_ID}", "question_type": "{example_type}", "prompt_text": "...", "options": ["...", "...", "...", "..."], "correct_index": 0, "explanation": "..."}}]}}"""


# Dạng có luật distractor dùng chung ở WORD_DISTRACTOR_RULES.
WORD_CHOICE_TYPES = ("cloze", "context")


def build_system_prompt(ai_types: Sequence[str]) -> str:
    """Ghép system prompt chỉ từ block của những dạng được yêu cầu.

    Thứ tự block bám theo `AI_QUESTION_TYPES` chứ không theo thứ tự người gọi
    truyền vào, để cùng một tập dạng luôn sinh ra đúng một chuỗi.
    """
    requested = set(ai_types)
    ordered = [t for t in AI_QUESTION_TYPES if t in requested]

    blocks = [
        f"{number}. {TYPE_RULES[question_type]}"
        for number, question_type in enumerate(ordered, start=1)
    ]

    parts = [SYSTEM_HEADER, "═══ QUESTION TYPES ═══\n\n" + "\n\n".join(blocks)]
    if any(question_type in WORD_CHOICE_TYPES for question_type in ordered):
        parts.append(WORD_DISTRACTOR_RULES)
    parts.extend([EXPLANATION_RULES, _technical_rules(ordered), _output_format(ordered)])

    return "\n\n".join(parts)


def _card_payload(card: Any) -> dict[str, Any]:
    return {
        "card_id": card.id,
        "front_text": card.front_text,
        "front_phonetic": getattr(card, "front_phonetic", None),
        "back_text": card.back_text,
        "example": getattr(card, "example", None),
        "synonyms": [synonym.word for synonym in card.synonyms],
    }


def build_prompt(
    cards: Sequence[Any],
    ai_types: Sequence[str],
    ai_question_count: int,
    max_cards: int,
    rng: Random | None = None,
) -> tuple[str, str]:
    """Trả về `(system, user)` cho một lần gọi sinh cả phần AI của đề.

    Raises:
        ValueError: Nếu `ai_types` rỗng hoặc chứa dạng mà thuật toán phụ trách.
    """
    if not ai_types:
        raise ValueError("Cần ít nhất một dạng câu hỏi AI")

    unsupported = [t for t in ai_types if t not in AI_QUESTION_TYPES]
    if unsupported:
        raise ValueError(
            f"AI chỉ sinh {', '.join(AI_QUESTION_TYPES)}; không nhận: "
            f"{', '.join(unsupported)}"
        )

    if rng is None:
        rng = Random()

    selected = list(cards)
    if len(selected) > max_cards:
        selected = rng.sample(selected, max_cards)

    payload = {
        "question_count": ai_question_count,
        "question_types": list(ai_types),
        "cards": [_card_payload(card) for card in selected],
    }

    user = (
        f"Write exactly {ai_question_count} questions from the following data:\n"
        f"{json.dumps(payload, ensure_ascii=False)}"
    )

    return build_system_prompt(ai_types), user


def _extract_json(raw: str) -> dict[str, Any]:
    """Bóc JSON ra khỏi code fence hoặc chữ thừa quanh nó.

    Không dựa vào `response_format` của endpoint, vì nhiều server tương thích
    lờ tham số đó đi và trả về JSON bọc trong ```json.

    Raises:
        ValueError: Nếu không tìm thấy JSON object nào đọc được.
    """
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("Không tìm thấy JSON object trong kết quả")

    try:
        parsed = json.loads(raw[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON hỏng: {exc}") from exc

    if not isinstance(parsed, dict):
        raise ValueError("Kết quả không phải JSON object")

    return parsed


def _check_cloze(item: dict[str, Any]) -> str | None:
    if CLOZE_BLANK not in item["prompt_text"]:
        return "câu cloze không có chỗ trống ___"
    return None


# Động từ nguyên thể trong ngoặc, ví dụ "(finish)" hay "(look after)".
VERB_HINT_RE = re.compile(r"\(\s*[A-Za-z][A-Za-z ]{0,30}\)")


def _check_verb_tense(item: dict[str, Any]) -> str | None:
    prompt_text = item["prompt_text"]
    if CLOZE_BLANK not in prompt_text:
        return "câu chia thì không có chỗ trống ___"
    if VERB_HINT_RE.search(prompt_text) is None:
        return "câu chia thì thiếu động từ nguyên thể trong ngoặc"
    return None


def _check_word_stress(item: dict[str, Any]) -> str | None:
    """Kiểm tra câu word_stress.

    prompt_text là nguyên từ, không tách âm tiết — âm tiết chỉ xuất hiện
    trong options. Ghép các âm tiết trong options lại theo đúng thứ tự phải
    cho ra chính xác prompt_text; đây vừa là cách xác nhận model chia âm tiết
    đúng chính tả, vừa thay cho việc so khớp từng âm tiết một.
    """
    prompt_text = item["prompt_text"]

    if any(mark in prompt_text for mark in STRESS_MARKS):
        return "prompt_text chứa dấu trọng âm, lộ đáp án"
    if prompt_text != prompt_text.lower():
        return "prompt_text viết hoa, lộ đáp án"

    syllables: list[str] = []
    for number, option in enumerate(item["options"], start=1):
        match = STRESS_OPTION_RE.match(option.strip())
        if match is None:
            return f"phương án {number} sai định dạng 'N — âm tiết'"
        if match.group(1) != str(number):
            return f"phương án {number} đánh số sai"
        syllable = match.group(2).strip()
        # Kiểu trình bày sách giáo khoa hay viết hoa âm tiết được nhấn trong
        # phương án (ví dụ "COMfortable") để nhấn mạnh — nhưng ở đây điều đó
        # lộ đáp án ngay lập tức, trước khi người học kịp chọn.
        if syllable != syllable.lower():
            return f"phương án {number} viết hoa, lộ đáp án"
        syllables.append(syllable)

    if "".join(syllables) != prompt_text:
        return "các âm tiết trong phương án ghép lại không khớp với prompt_text"

    # An toàn để lộ ở đây: explanation chỉ hiện sau khi người học đã trả lời
    # (xem AnswerSubmitResponse.explanation), khác với prompt_text ở trên.
    if IPA_TRANSCRIPTION_RE.search(item["explanation"]) is None:
        return "explanation thiếu phiên âm IPA có đánh dấu trọng âm"

    return None


TYPE_CHECKS: dict[str, Callable[[dict[str, Any]], str | None]] = {
    "cloze": _check_cloze,
    "verb_tense": _check_verb_tense,
    "word_stress": _check_word_stress,
}


def _reject_reason(
    item: Any,
    cards_by_id: dict[str, Any],
    allowed_types: set[str],
    used_card_ids: set[str],
) -> str | None:
    """Lý do loại câu này, hoặc None nếu câu dùng được."""
    if not isinstance(item, dict):
        return "không phải object"

    card_id = item.get("card_id")
    if card_id not in cards_by_id:
        return f"card_id không hợp lệ: {card_id!r}"
    if card_id in used_card_ids:
        return f"thẻ {card_id} đã được dùng cho câu trước"

    question_type = item.get("question_type")
    if question_type not in allowed_types:
        return f"dạng câu hỏi không được yêu cầu: {question_type!r}"

    prompt_text = item.get("prompt_text")
    if not isinstance(prompt_text, str) or not prompt_text.strip():
        return "prompt_text rỗng"

    options = item.get("options")
    if not isinstance(options, list):
        return "options không phải mảng"
    if not MIN_OPTION_COUNT <= len(options) <= MAX_OPTION_COUNT:
        return f"số phương án phải từ {MIN_OPTION_COUNT} đến {MAX_OPTION_COUNT}"
    if not all(isinstance(option, str) and option.strip() for option in options):
        return "có phương án rỗng"
    if len({_normalize(option) for option in options}) != len(options):
        return "có phương án trùng nhau"

    expected_count = OPTION_COUNT.get(question_type)
    if expected_count is not None and len(options) != expected_count:
        return f"cần đúng {expected_count} phương án"

    correct_index = item.get("correct_index")
    if not isinstance(correct_index, int) or isinstance(correct_index, bool):
        return "correct_index không phải số nguyên"
    if not 0 <= correct_index < len(options):
        return f"correct_index ngoài khoảng: {correct_index}"

    explanation = item.get("explanation")
    if not isinstance(explanation, str) or not explanation.strip():
        return "thiếu explanation"

    check = TYPE_CHECKS.get(question_type)
    if check is not None:
        return check(item)

    return None


def parse_and_validate(
    raw: str,
    cards: Sequence[Any],
    ai_types: Sequence[str],
) -> tuple[list[GeneratedQuestion], list[str]]:
    """Lọc lấy những câu hỏi dùng được từ kết quả thô của LLM.

    Câu nào không đạt thì bị bỏ, kèm một dòng lý do để ghi log. Một câu hỏng
    không làm hỏng cả đề.

    Returns:
        `(câu hợp lệ, lý do các câu bị loại)`.
    """
    try:
        payload = _extract_json(raw)
    except ValueError as exc:
        return [], [str(exc)]

    items = payload.get("questions")
    if not isinstance(items, list):
        return [], ["Kết quả thiếu mảng 'questions'"]

    cards_by_id = {card.id: card for card in cards}
    allowed_types = set(ai_types)
    accepted: list[GeneratedQuestion] = []
    rejected: list[str] = []
    used_card_ids: set[str] = set()

    for index, item in enumerate(items):
        reason = _reject_reason(item, cards_by_id, allowed_types, used_card_ids)
        if reason is not None:
            rejected.append(f"Câu {index}: {reason}")
            continue

        used_card_ids.add(item["card_id"])
        accepted.append(
            GeneratedQuestion(
                card_id=item["card_id"],
                question_type=item["question_type"],
                prompt_text=item["prompt_text"].strip(),
                prompt_phonetic=None,
                options=[str(option) for option in item["options"]],
                correct_index=int(item["correct_index"]),
                explanation=item["explanation"].strip(),
                source="ai",
            )
        )

    return accepted, rejected
