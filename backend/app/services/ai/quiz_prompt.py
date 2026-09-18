"""Dựng prompt và kiểm tra kết quả LLM trả về.

Thuần: không chạm DB, không gọi mạng. Mọi thứ model trả ra đi qua
`parse_and_validate` trước khi tới database — đây là ranh giới tin cậy của
tính năng, nên phần kiểm tra ở đây cố tình chi tiết và bảo thủ.
"""
import json
from collections.abc import Sequence
from random import Random
from typing import Any

from app.services.quiz_generator import AI_QUESTION_TYPES, GeneratedQuestion, _normalize

CLOZE_BLANK = "___"
REQUIRED_OPTION_COUNT = 4

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

TECHNICAL_RULES = """\
═══ RÀNG BUỘC KỸ THUẬT ═══

- card_id phải là một trong các card_id đã cho — không bịa ra.
- Không dùng cùng một card_id cho hai câu hỏi.
- question_type phải nằm trong danh sách question_types được yêu cầu.
- correct_index là số nguyên từ 0 đến (số phương án trừ 1), trỏ đúng vào phương án đúng trong mảng options.
- Không phương án nào được rỗng hay trùng nhau.
- Vị trí đáp án đúng nên phân bố đều giữa các câu, không luôn đặt ở vị trí 0."""

OUTPUT_FORMAT = """\
═══ ĐỊNH DẠNG ═══

Trả về DUY NHẤT một JSON object, không kèm markdown, không kèm chữ giải thích bên ngoài:
{"questions": [{"card_id": "...", "question_type": "cloze", "prompt_text": "...", "options": ["...", "...", "...", "..."], "correct_index": 0, "explanation": "..."}]}"""

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
    parts.extend([EXPLANATION_RULES, TECHNICAL_RULES, OUTPUT_FORMAT])

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
    if question_type == "cloze" and CLOZE_BLANK not in prompt_text:
        return "câu cloze không có chỗ trống ___"

    options = item.get("options")
    if not isinstance(options, list) or len(options) != REQUIRED_OPTION_COUNT:
        return f"cần đúng {REQUIRED_OPTION_COUNT} phương án"
    if not all(isinstance(option, str) and option.strip() for option in options):
        return "có phương án rỗng"
    if len({_normalize(option) for option in options}) != REQUIRED_OPTION_COUNT:
        return "có phương án trùng nhau"

    correct_index = item.get("correct_index")
    if not isinstance(correct_index, int) or isinstance(correct_index, bool):
        return "correct_index không phải số nguyên"
    if not 0 <= correct_index < REQUIRED_OPTION_COUNT:
        return f"correct_index ngoài khoảng: {correct_index}"

    explanation = item.get("explanation")
    if not isinstance(explanation, str) or not explanation.strip():
        return "thiếu explanation"

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
