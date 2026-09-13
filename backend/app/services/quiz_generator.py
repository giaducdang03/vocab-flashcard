"""Generate multiple-choice quiz questions from a pool of cards.

Pure functions only — no database access — so the tricky parts (distractor
selection, splitting a question count across types) can be unit tested.
"""
from collections.abc import Sequence
from dataclasses import dataclass
from random import Random
from typing import Any

QUESTION_TYPES: tuple[str, str, str] = ("en_to_vi", "vi_to_en", "synonym")

# One correct answer plus three distractors means a question needs four
# distinct cards to draw from.
MIN_POOL_SIZE = 4


@dataclass(frozen=True)
class GeneratedQuestion:
    """A generated multiple-choice question."""
    card_id: str
    question_type: str
    prompt_text: str
    prompt_phonetic: str | None
    options: list[str]
    correct_index: int


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


def _normalize(text: str) -> str:
    """Normalize text for comparison."""
    return text.strip().lower()


def _distractor_field(question_type: str) -> str:
    """Return the field to use for distractors."""
    if question_type == "en_to_vi":
        return "back_text"
    return "front_text"


def _answer_of(card: Any, question_type: str, rng: Random | None = None) -> str:
    """Get the correct answer for a card based on question type."""
    if question_type == "en_to_vi":
        return card.back_text
    elif question_type == "vi_to_en":
        return card.front_text
    elif question_type == "synonym":
        if rng is None:
            rng = Random()
        return rng.choice([syn.word for syn in card.synonyms])
    raise ValueError(f"Unknown question type: {question_type}")


def _prompt_of(card: Any, question_type: str) -> tuple[str, str | None]:
    """Get the prompt and phonetic for a card based on question type."""
    if question_type == "vi_to_en":
        return (card.back_text, None)
    else:
        return (card.front_text, card.front_phonetic)


def _build_options(
    card: Any, question_type: str, pool: Sequence[Any], rng: Random
) -> tuple[list[str], int] | None:
    """Build four distinct options for a card, or None if can't find distractors.

    Returns: (options, correct_index)
    """
    correct_answer = _answer_of(card, question_type, rng)
    distractor_field_name = _distractor_field(question_type)

    # Build set of banned values (values to exclude from distractors)
    banned = {_normalize(correct_answer), _normalize(card.front_text)}
    if question_type == "synonym":
        # For synonym questions, also ban all other synonyms of this card
        for syn in card.synonyms:
            banned.add(_normalize(syn.word))

    # Collect distractors from other cards
    distractors = []
    for other_card in pool:
        if other_card.id == card.id:
            continue
        distractor = getattr(other_card, distractor_field_name)
        # Ensure distractor is not in banned set (case-insensitive)
        if _normalize(distractor) not in banned:
            distractors.append(distractor)

    # Remove duplicate distractors (case-insensitive)
    unique_distractors = []
    seen = set()
    for d in distractors:
        normalized = _normalize(d)
        if normalized not in seen:
            unique_distractors.append(d)
            seen.add(normalized)

    # Need at least 3 distractors
    if len(unique_distractors) < 3:
        return None

    # Pick 3 random distractors
    selected_distractors = rng.sample(unique_distractors, 3)

    # Build options and shuffle
    options = [correct_answer] + selected_distractors
    rng.shuffle(options)

    # Find the correct index after shuffling
    correct_index = options.index(correct_answer)

    return (options, correct_index)


def _distribute(
    question_count: int, capacity: dict[str, int], rng: Random
) -> dict[str, int]:
    """Distribute question_count across types based on capacity.

    Returns a dict mapping question_type to number of questions to generate.
    """
    # Filter types with capacity > 0
    available_types = [t for t in capacity if capacity[t] > 0]
    if not available_types:
        return {}

    distribution = {t: 0 for t in capacity}
    remaining = question_count

    # Distribute evenly first
    per_type = remaining // len(available_types)
    for t in available_types:
        allocation = min(per_type, capacity[t])
        distribution[t] = allocation
        remaining -= allocation

    # Distribute leftover
    while remaining > 0:
        for t in rng.sample(available_types, len(available_types)):
            if remaining == 0:
                break
            if distribution[t] < capacity[t]:
                distribution[t] += 1
                remaining -= 1

    return distribution


def generate_questions(
    cards: Sequence[Any],
    question_types: Sequence[str],
    question_count: int,
    rng: Random | None = None,
) -> list[GeneratedQuestion]:
    """Generate multiple-choice questions from a pool of cards.

    Args:
        cards: Pool of cards to generate questions from
        question_types: List of question types to generate (e.g., ["en_to_vi", "vi_to_en"])
        question_count: Number of questions to generate
        rng: Random number generator (default: use module-level Random())

    Returns:
        List of GeneratedQuestion objects

    Raises:
        ValueError: If pool < 4 cards or question_types is empty
    """
    if rng is None:
        rng = Random()

    # Validate inputs
    if len(cards) < MIN_POOL_SIZE:
        raise ValueError(f"Need at least {MIN_POOL_SIZE} cards to generate questions")

    if not question_types:
        raise ValueError("Select at least one question type")

    # Calculate capacity for each type
    capacity = compute_capacity(cards, question_types)

    # Cap question_count to total available capacity
    total_capacity = sum(capacity.values())
    actual_question_count = min(question_count, total_capacity)

    # Distribute questions across types
    distribution = _distribute(actual_question_count, capacity, rng)

    # Generate questions for each type
    questions = []
    for question_type in question_types:
        num_to_generate = distribution[question_type]
        if num_to_generate == 0:
            continue

        # Filter eligible cards for this type and shuffle
        eligible_cards = [c for c in cards if _is_eligible(c, question_type)]
        rng.shuffle(eligible_cards)

        # Generate questions
        for card in eligible_cards[:num_to_generate]:
            # For synonym questions, use all cards as distractor pool; for translation, use eligible cards
            distractor_pool = cards if question_type == "synonym" else eligible_cards
            options_result = _build_options(card, question_type, distractor_pool, rng)

            if options_result is None:
                continue

            options, correct_index = options_result
            prompt_text, prompt_phonetic = _prompt_of(card, question_type)

            question = GeneratedQuestion(
                card_id=card.id,
                question_type=question_type,
                prompt_text=prompt_text,
                prompt_phonetic=prompt_phonetic,
                options=options,
                correct_index=correct_index,
            )
            questions.append(question)

    # Shuffle the final question order
    rng.shuffle(questions)

    return questions


def generate_practice_questions(
    cards: Sequence[Any],
    question_types: Sequence[str],
    rng: Random | None = None,
) -> list[GeneratedQuestion]:
    """One question per card for a throwaway practice run.

    Unlike `generate_questions`, nothing here is persisted and the caller wants
    the whole session covered, so every card appears exactly once. The question
    type for a card is drawn at random from the requested types that card is
    eligible for — a card with no synonyms simply gets a translation question.

    Raises:
        ValueError: If pool < 4 cards, question_types is empty, or a type is unknown.
    """
    if rng is None:
        rng = Random()

    if len(cards) < MIN_POOL_SIZE:
        raise ValueError(f"Need at least {MIN_POOL_SIZE} cards to practice")

    if not question_types:
        raise ValueError("Select at least one question type")

    for question_type in question_types:
        if question_type not in QUESTION_TYPES:
            raise ValueError(f"Unknown question type: {question_type}")

    questions: list[GeneratedQuestion] = []

    for card in cards:
        candidates = [t for t in question_types if _is_eligible(card, t)]
        if not candidates:
            continue

        rng.shuffle(candidates)

        # Try each eligible type until one can find three distractors.
        for question_type in candidates:
            options_result = _build_options(card, question_type, cards, rng)
            if options_result is None:
                continue

            options, correct_index = options_result
            prompt_text, prompt_phonetic = _prompt_of(card, question_type)

            questions.append(
                GeneratedQuestion(
                    card_id=card.id,
                    question_type=question_type,
                    prompt_text=prompt_text,
                    prompt_phonetic=prompt_phonetic,
                    options=options,
                    correct_index=correct_index,
                )
            )
            break

    rng.shuffle(questions)

    return questions
