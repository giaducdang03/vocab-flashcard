from typing import Literal

from pydantic import BaseModel, Field

QuestionType = Literal["en_to_vi", "vi_to_en", "synonym"]

# Which slice of a session a practice run draws its questions from, by learned state.
PracticePool = Literal["all", "unlearned", "learned"]


class PracticeStartRequest(BaseModel):
    question_types: list[QuestionType] = Field(min_length=1)
    pool: PracticePool = "all"


class PracticeQuestionOut(BaseModel):
    card_id: str
    question_type: QuestionType
    prompt_text: str
    prompt_phonetic: str | None = None
    options: list[str]
    correct_index: int
    position: int


class PracticeStartOut(BaseModel):
    session_id: str
    session_title: str
    pool: PracticePool
    questions: list[PracticeQuestionOut]
