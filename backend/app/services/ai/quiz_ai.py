"""Một lần gọi LLM sinh cả phần AI của đề, rồi bù phần thiếu bằng thuật toán.

Hàm ở đây không chạm DB: nó nhận card, trả câu hỏi. Router lo phần ghi.
"""
import logging
from collections.abc import Sequence
from dataclasses import dataclass, field
from random import Random
from typing import Any

from app.config import settings
from app.services.ai.provider import LLMProvider
from app.services.ai.quiz_prompt import build_prompt, parse_and_validate
from app.services.quiz_generator import GeneratedQuestion, generate_questions

logger = logging.getLogger(__name__)


@dataclass
class AiGenerationResult:
    questions: list[GeneratedQuestion] = field(default_factory=list)
    ai_count: int = 0
    rejected: list[str] = field(default_factory=list)
    # Chỉ đặt khi bản thân lời gọi LLM hỏng. Câu bị loại lẻ tẻ không tính là lỗi.
    error: str | None = None


async def generate_ai_questions(
    provider: LLMProvider,
    cards: Sequence[Any],
    ai_types: Sequence[str],
    ai_count: int,
    fallback_types: Sequence[str],
    rng: Random | None = None,
) -> AiGenerationResult:
    """Sinh `ai_count` câu cho các dạng AI, bù phần thiếu bằng thuật toán.

    Args:
        provider: Nhà cung cấp LLM đã cấu hình.
        cards: Toàn bộ card của các session nguồn.
        ai_types: Chỉ gồm dạng AI; `build_prompt` sẽ raise nếu không phải.
        ai_count: Số câu người dùng đã phân cho các dạng AI.
        fallback_types: Các dạng thuật toán người dùng đã chọn, dùng để bù.
            Rỗng nghĩa là người dùng chỉ chọn dạng AI, khi đó đề chấp nhận
            ngắn hơn yêu cầu.
        rng: Random number generator.

    Lỗi của provider được trả về trong `error` chứ không ném ra ngoài, vì hàm
    này chạy trong background task và người gọi cần ghi lý do vào DB.
    """
    if rng is None:
        rng = Random()

    result = AiGenerationResult()

    try:
        system, user = build_prompt(
            cards, ai_types, ai_count, settings.AI_MAX_CARDS_PER_PROMPT, rng
        )
        raw = await provider.complete_json(system, user)
        accepted, rejected = parse_and_validate(raw, cards, ai_types)
        result.questions = list(accepted)
        result.ai_count = len(accepted)
        result.rejected = rejected
        if rejected:
            logger.warning("Bỏ %d câu AI không hợp lệ: %s", len(rejected), rejected)
    except Exception as exc:  # noqa: BLE001 — lỗi nào cũng phải thành error text
        logger.exception("Gọi LLM thất bại")
        result.error = str(exc) or exc.__class__.__name__

    missing = ai_count - len(result.questions)
    if missing > 0 and fallback_types:
        used_card_ids = {question.card_id for question in result.questions}
        remaining = [card for card in cards if card.id not in used_card_ids]
        try:
            result.questions.extend(
                generate_questions(remaining, list(fallback_types), missing, rng)
            )
        except ValueError:
            # Pool còn lại quá nhỏ để bù. Đề ngắn hơn vẫn tốt hơn là không có đề.
            logger.warning("Không đủ thẻ để bù %d câu thuật toán", missing)

    return result
