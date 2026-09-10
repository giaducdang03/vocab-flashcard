"""Generate multiple-choice quiz questions from a pool of cards.

Pure functions only — no database access — so the tricky parts (distractor
selection, splitting a question count across types) can be unit tested.
"""
from collections.abc import Sequence
from typing import Any

QUESTION_TYPES: tuple[str, str, str] = ("en_to_vi", "vi_to_en", "synonym")

# One correct answer plus three distractors means a question needs four
# distinct cards to draw from.
MIN_POOL_SIZE = 4


def _is_eligible(card: Any, question_type: str) -> bool:
    if question_type == "synonym":
        return card.card_type == "vocab" and len(card.synonyms) > 0
    return True


def compute_capacity(cards: Sequence[Any], question_types: Sequence[str]) -> dict[str, int]:
    """Max questions each type can produce from this pool."""
    if len(cards) < MIN_POOL_SIZE:
        return {question_type: 0 for question_type in question_types}

    return {
        question_type: sum(1 for card in cards if _is_eligible(card, question_type))
        for question_type in question_types
    }
