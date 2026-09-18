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

# Dấu trọng âm IPA: xuất hiện trong prompt_text là lộ đáp án.
STRESS_MARKS = ("ˈ", "ˌ")
STRESS_OPTION_RE = re.compile(r"^(\d+) — (.+)$")

SYSTEM_HEADER = """\
Bạn là giáo viên tiếng Anh giàu kinh nghiệm, chuyên soạn đề trắc nghiệm từ vựng cho người Việt trình độ B1–B2.

Bạn nhận một danh sách thẻ từ vựng (mỗi thẻ gồm card_id, front_text, back_text, example, synonyms). Nhiệm vụ: soạn câu hỏi CHỈ dựa trên các thẻ đó."""

TYPE_RULES: dict[str, str] = {
    "cloze": """\
"cloze" — Điền từ vào chỗ trống
   • Viết MỘT câu tiếng Anh tự nhiên 10–20 từ, chứa đúng một chỗ trống kí hiệu ___ (ba dấu gạch dưới liền, không thêm không bớt).
   • Câu phải cung cấp đủ ngữ cảnh để chỉ có MỘT đáp án đúng; tránh câu quá chung chung mà đáp án nào cũng lắp vào được.
   • Đáp án đúng là front_text của thẻ.
   • Nếu thẻ có trường example, KHÔNG được sao chép nguyên câu example; hãy viết câu mới khác ngữ cảnh.
   • Đúng 4 phương án.""",
    "context": """\
"context" — Chọn từ phù hợp tình huống
   • Mô tả một tình huống cụ thể bằng tiếng Anh (2–3 câu), rồi hỏi từ nào phù hợp nhất.
   • Tình huống phải đủ chi tiết để phân biệt rõ đáp án đúng với các phương án gần nghĩa.
   • Đáp án đúng là front_text của thẻ.
   • Đúng 4 phương án.""",
    "verb_tense": """\
"verb_tense" — Chia thì động từ
   • CHỈ dùng thẻ mà front_text là một ĐỘNG TỪ. Thẻ không phải động từ thì bỏ qua hoàn toàn, không ép ra đề.
   • Viết MỘT câu tiếng Anh 12–25 từ, chứa đúng một chỗ trống kí hiệu ___ (ba dấu gạch dưới liền), và ngay sau chỗ trống là động từ nguyên thể đặt trong ngoặc đơn.
     Ví dụ: "By the time we arrived, the meeting ___ (finish) already."
   • Trong ngoặc CHỈ được chứa động từ nguyên thể viết bằng chữ cái, không thêm số hay dấu câu.
   • Câu BẮT BUỘC có dấu hiệu thời gian rõ ràng (by the time, since 2010, while, every morning, this time next year, ...) để chỉ có ĐÚNG MỘT thì đúng.
   • Đúng 4 phương án, đều là các dạng chia KHÁC NHAU của CHÍNH động từ đó. Không đổi sang động từ khác.
   • Ba phương án sai phải là những thì mà người học Việt hay nhầm trong đúng ngữ cảnh này (ví dụ present perfect và past simple), không phải dạng vô nghĩa.
   • explanation phải nêu rõ dấu hiệu thời gian nào quyết định thì đúng.""",
    "word_stress": """\
"word_stress" — Trọng âm từ
   • CHỈ dùng thẻ mà front_text là MỘT từ đơn có 2–4 âm tiết. Thẻ một âm tiết, trên 4 âm tiết, hoặc là cụm nhiều từ thì bỏ qua hoàn toàn.
   • prompt_text là NGUYÊN VẸN từ đó, viết liền không tách âm tiết.
     Ví dụ: "comfortable"
   • TUYỆT ĐỐI KHÔNG đánh dấu trọng âm hay tách âm tiết trong prompt_text: không dùng ˈ, không dùng ˌ, không viết hoa chữ nào. prompt_text viết thường hoàn toàn, đúng chính tả của từ.
   • Số phương án đúng bằng số âm tiết của từ (2, 3 hoặc 4) — đây là ngoại lệ duy nhất của quy tắc 4 phương án.
   • Phương án thứ i có dạng "i — âm tiết thứ i", nối bằng " — " (dấu gạch dài, có một khoảng trắng ở mỗi bên), liệt kê theo đúng thứ tự âm tiết trong từ.
   • Ghép các âm tiết trong phương án lại theo đúng thứ tự PHẢI cho ra CHÍNH XÁC prompt_text.
     Ví dụ với prompt_text "comfortable": ["1 — com", "2 — for", "3 — ta", "4 — ble"] (com+for+ta+ble = comfortable).
   • correct_index trỏ vào âm tiết mang TRỌNG ÂM CHÍNH.
   • explanation phải nêu quy tắc trọng âm áp dụng được (ví dụ: hậu tố -able không làm đổi trọng âm; từ kết thúc bằng -tion nhấn vào âm tiết ngay trước nó).""",
}

WORD_DISTRACTOR_RULES = """\
═══ QUY TẮC PHƯƠNG ÁN SAI (DISTRACTORS) — áp dụng cho dạng cloze và context ═══

- Mỗi câu có ĐÚNG 4 phương án. Không phương án nào trùng nhau (kể cả khác hoa/thường).
- Ba phương án sai phải:
  ─ Cùng từ loại (part of speech) với đáp án đúng.
  ─ KHÁC NGHĨA RÕ RỆT với nhau — không chọn hai từ gần đồng nghĩa làm distractor cùng lúc.
    Ví dụ xấu: đáp án "delighted", distractors ["happy", "glad", "joyful"] ← cả ba gần nghĩa nhau.
    Ví dụ tốt:  đáp án "delighted", distractors ["exhausted", "reluctant", "confused"] ← ba hướng nghĩa khác nhau.
  ─ Có vẻ hợp lý ở mức bề mặt (cùng chủ đề hoặc cùng mức độ phổ biến) để câu hỏi không quá dễ, nhưng SAI rõ ràng khi đọc kỹ ngữ cảnh.
  ─ Không lấy từ trường synonyms của thẻ làm distractor (vì synonym có thể cũng đúng).
- Vị trí đáp án đúng (correct_index) nên phân bố đều, không luôn đặt ở vị trí 0."""

EXPLANATION_RULES = """\
═══ QUY TẮC GIẢI THÍCH (explanation) ═══

Viết bằng tiếng Việt, 2–4 câu, theo cấu trúc:
1. Nêu đáp án đúng và giải thích TẠI SAO nó phù hợp ngữ cảnh (dùng nghĩa hoặc collocation).
2. Chọn 1–2 phương án sai dễ nhầm nhất, giải thích ngắn gọn vì sao chúng không phù hợp trong ngữ cảnh này.
Không viết chung chung kiểu "các phương án kia không đúng". Phải chỉ ra điểm sai cụ thể."""

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
═══ RÀNG BUỘC KỸ THUẬT ═══

- card_id của MỖI câu PHẢI là giá trị y hệt trường "card_id" của thẻ tương ứng trong dữ liệu đầu vào (một chuỗi ký tự dạng UUID, ví dụ "{_EXAMPLE_CARD_ID}") — sao chép nguyên văn, không bịa ra, TUYỆT ĐỐI không dùng front_text hay back_text làm card_id.
- Không dùng cùng một card_id cho hai câu hỏi.
- question_type của MỖI câu PHẢI là một trong đúng các giá trị sau: {allowed}. Không dùng giá trị nào khác, kể cả dạng câu hỏi có thật của hệ thống nhưng không nằm trong danh sách này.
- correct_index là số nguyên từ 0 đến (số phương án trừ 1), trỏ đúng vào phương án đúng trong mảng options.
- Không phương án nào được rỗng hay trùng nhau.
- Vị trí đáp án đúng nên phân bố đều giữa các câu, không luôn đặt ở vị trí 0."""


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
═══ ĐỊNH DẠNG ═══

Trả về DUY NHẤT một JSON object, không kèm markdown, không kèm chữ giải thích bên ngoài:
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

    parts = [SYSTEM_HEADER, "═══ DẠNG CÂU HỎI ═══\n\n" + "\n\n".join(blocks)]
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
        f"Soạn đúng {ai_question_count} câu hỏi từ dữ liệu sau:\n"
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
        syllables.append(match.group(2).strip())

    if "".join(syllables) != prompt_text:
        return "các âm tiết trong phương án ghép lại không khớp với prompt_text"

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
