from typing import Literal

from pydantic import BaseModel, Field


CardType = Literal["vocab", "collocation"]


class SynonymCreate(BaseModel):
    word: str = Field(min_length=1, max_length=200)
    phonetic: str | None = Field(default=None, max_length=200)


class CardCreate(BaseModel):
    card_type: CardType = "vocab"
    front_text: str = Field(min_length=1, max_length=500)
    front_phonetic: str | None = Field(default=None, max_length=200)
    back_text: str = Field(min_length=1)
    example: str | None = None
    is_learned: bool = False
    position: int = 0
    synonyms: list[SynonymCreate] = Field(default_factory=list)


class CardUpdate(BaseModel):
    card_type: CardType | None = None
    front_text: str | None = Field(default=None, min_length=1, max_length=500)
    front_phonetic: str | None = Field(default=None, max_length=200)
    back_text: str | None = Field(default=None, min_length=1)
    example: str | None = None
    is_learned: bool | None = None
    position: int | None = None
    synonyms: list[SynonymCreate] | None = None


class LearnedToggleRequest(BaseModel):
    is_learned: bool


class SynonymOut(BaseModel):
    id: str
    word: str
    phonetic: str | None = None

    class Config:
        from_attributes = True


class CardOut(BaseModel):
    id: str
    session_id: str
    card_type: CardType
    front_text: str
    front_phonetic: str | None = None
    back_text: str
    example: str | None = None
    is_learned: bool
    position: int
    synonyms: list[SynonymOut] = Field(default_factory=list)

    class Config:
        from_attributes = True
