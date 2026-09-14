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

SYSTEM_PROMPT = """Bạn là giáo viên tiếng Anh soạn câu hỏi trắc nghiệm cho người học Việt Nam.

Bạn nhận một danh sách thẻ từ vựng và phải soạn câu hỏi CHỈ dựa trên các thẻ đó.

Dạng câu hỏi:
- "cloze": một câu tiếng Anh tự nhiên có chỗ trống viết đúng ba dấu gạch dưới (___). Đáp án đúng là từ ở front_text của thẻ. Ba phương án còn lại là từ tiếng Anh khác, sai về nghĩa trong ngữ cảnh đó nhưng cùng loại từ.
- "context": mô tả một tình huống bằng tiếng Anh rồi hỏi từ nào hợp nhất. Đáp án đúng là front_text của thẻ. Ba phương án còn lại là từ tiếng Anh gần nghĩa nhưng sai sắc thái.

Quy tắc bắt buộc:
- Mỗi câu có ĐÚNG 4 phương án, không phương án nào trùng nhau.
- correct_index là chỉ số của đáp án đúng trong mảng options, từ 0 đến 3.
- explanation viết bằng tiếng Việt, một tới hai câu, giải thích vì sao đáp án đúng và vì sao các phương án kia sai.
- card_id phải là một trong các card_id đã cho.
- Không lặp lại cùng một thẻ hai lần.

Chỉ trả về một JSON object đúng dạng sau, không kèm chữ nào khác:
{"questions": [{"card_id": "...", "question_type": "cloze", "prompt_text": "...", "options": ["...", "...", "...", "..."], "correct_index": 0, "explanation": "..."}]}"""


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

    return SYSTEM_PROMPT, user


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
