"""Lightweight stand-ins for SQLAlchemy Card/Synonym.

quiz_generator is a pure function that only reads attributes, so tests do not
need a database.
"""
from dataclasses import dataclass, field


@dataclass
class FakeSynonym:
    word: str
    phonetic: str | None = None


@dataclass
class FakeCard:
    id: str
    front_text: str
    back_text: str
    card_type: str = "vocab"
    front_phonetic: str | None = None
    synonyms: list[FakeSynonym] = field(default_factory=list)


def make_card(
    index: int,
    card_type: str = "vocab",
    synonyms: list[str] | None = None,
) -> FakeCard:
    """Build a card with predictable, mutually distinct text."""
    return FakeCard(
        id=f"card-{index}",
        front_text=f"word{index}",
        back_text=f"nghia{index}",
        card_type=card_type,
        front_phonetic=f"/w{index}/",
        synonyms=[FakeSynonym(word=word) for word in (synonyms or [])],
    )


def make_pool(size: int, synonyms_for: set[int] | None = None) -> list[FakeCard]:
    """Build `size` distinct cards; those whose index is in `synonyms_for`
    get one synonym each."""
    synonyms_for = synonyms_for or set()
    return [
        make_card(index, synonyms=[f"syn{index}"] if index in synonyms_for else None)
        for index in range(size)
    ]
