from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

QuestionType = Literal["en_to_vi", "vi_to_en", "synonym"]


class CapacityRequest(BaseModel):
    session_ids: list[str] = Field(min_length=1)
    question_types: list[QuestionType] = Field(min_length=1)


class CapacityResponse(BaseModel):
    total_cards: int
    per_type: dict[str, int]
    max_questions: int


class QuizCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    session_ids: list[str] = Field(min_length=1)
    question_count: int = Field(ge=1, le=100)
    question_types: list[QuestionType] = Field(min_length=1)


class QuizListItem(BaseModel):
    id: str
    title: str
    question_types: list[QuestionType]
    question_count: int
    source_session_titles: list[str]
    attempt_count: int
    best_score: int | None = None
    last_attempt_at: datetime | None = None
    created_at: datetime


class AttemptSummary(BaseModel):
    id: str
    submitted_at: datetime
    score: int
    total_questions: int
    duration_seconds: int | None = None


class QuizDetailOut(BaseModel):
    quiz: QuizListItem
    attempts: list[AttemptSummary]


class QuestionOut(BaseModel):
    """Sent while taking the quiz. Deliberately has no correct_index."""

    id: str
    question_type: QuestionType
    prompt_text: str
    prompt_phonetic: str | None = None
    options: list[str]
    position: int


class AttemptStartOut(BaseModel):
    attempt_id: str
    quiz_id: str
    quiz_title: str
    questions: list[QuestionOut]


class AnswerSubmitRequest(BaseModel):
    question_id: str
    selected_index: int | None = Field(default=None, ge=0, le=3)


class AnswerSubmitResponse(BaseModel):
    is_correct: bool
    correct_index: int


class AttemptSubmitResponse(BaseModel):
    attempt_id: str
    score: int
    total_questions: int
    duration_seconds: int


class ReviewQuestionOut(BaseModel):
    """Sent only after the attempt is submitted."""

    id: str
    question_type: QuestionType
    prompt_text: str
    prompt_phonetic: str | None = None
    options: list[str]
    position: int
    correct_index: int
    selected_index: int | None = None
    is_correct: bool
    card_id: str | None = None


class AttemptReviewOut(BaseModel):
    attempt_id: str
    quiz_id: str
    quiz_title: str
    score: int
    total_questions: int
    duration_seconds: int | None = None
    submitted_at: datetime
    questions: list[ReviewQuestionOut]
