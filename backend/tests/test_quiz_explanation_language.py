import pytest
from pydantic import ValidationError

from app.schemas.quiz import QuizCreate


def _payload(**extra) -> dict:
    return {
        "title": "T",
        "session_ids": ["s1"],
        "question_count": 5,
        "question_types": ["cloze"],
        **extra,
    }


def test_explanation_language_defaults_to_vietnamese():
    assert QuizCreate(**_payload()).explanation_language == "vi"


def test_explanation_language_accepts_english():
    assert QuizCreate(**_payload(explanation_language="en")).explanation_language == "en"


def test_explanation_language_rejects_other_values():
    with pytest.raises(ValidationError):
        QuizCreate(**_payload(explanation_language="fr"))


def test_quiz_model_defaults_to_vietnamese():
    from app.models.quiz import Quiz

    column = Quiz.__table__.c.explanation_language
    assert column.nullable is False
    assert column.default.arg == "vi"
