"""Test điều phối generate_ai_questions: gọi provider giả, kiểm tra bù thiếu."""
import json
from random import Random

import pytest

from app.services.ai.quiz_ai import generate_ai_questions
from tests.factories import make_pool


class FakeProvider:
    """Provider giả: trả sẵn `raw`, hoặc ném `error` nếu được đặt."""

    def __init__(self, raw: str | None = None, error: Exception | None = None):
        self.raw = raw
        self.error = error
        self.model = "fake-model"
        self.calls: list[tuple[str, str]] = []

    async def complete_json(self, system: str, user: str, max_tokens: int = 4096) -> str:
        self.calls.append((system, user))
        if self.error is not None:
            raise self.error
        return self.raw


def _question(card_id: str) -> dict:
    return {
        "card_id": card_id,
        "question_type": "cloze",
        "prompt_text": "The harvest was ___ this year.",
        "options": ["word0", "word1", "word2", "word3"],
        "correct_index": 0,
        "explanation": "word0 nghĩa là dồi dào, hợp với vụ mùa bội thu.",
    }


def _raw_questions(card_ids: list[str]) -> str:
    return json.dumps({"questions": [_question(cid) for cid in card_ids]}, ensure_ascii=False)


class TestGenerateAiQuestions:
    async def test_valid_ai_questions_are_returned_with_source_ai(self):
        cards = make_pool(8)
        provider = FakeProvider(raw=_raw_questions(["card-0", "card-1", "card-2"]))

        result = await generate_ai_questions(
            provider, cards, ["cloze"], ai_count=3, fallback_types=["en_to_vi"], rng=Random(1)
        )

        assert result.error is None
        assert result.ai_count == 3
        assert len(result.questions) == 3
        assert all(question.source == "ai" for question in result.questions)
        assert {question.card_id for question in result.questions} == {
            "card-0",
            "card-1",
            "card-2",
        }

    async def test_algorithmic_backfill_when_ai_produces_too_few(self):
        cards = make_pool(8)
        provider = FakeProvider(raw=_raw_questions(["card-0"]))

        result = await generate_ai_questions(
            provider, cards, ["cloze"], ai_count=3, fallback_types=["en_to_vi"], rng=Random(1)
        )

        assert result.error is None
        assert result.ai_count == 1
        assert len(result.questions) == 3
        ai_questions = [q for q in result.questions if q.source == "ai"]
        algo_questions = [q for q in result.questions if q.source == "algo"]
        assert len(ai_questions) == 1
        assert len(algo_questions) == 2

    async def test_backfill_never_reuses_cards_the_ai_used(self):
        cards = make_pool(8)
        provider = FakeProvider(raw=_raw_questions(["card-0"]))

        result = await generate_ai_questions(
            provider, cards, ["cloze"], ai_count=3, fallback_types=["en_to_vi"], rng=Random(1)
        )

        algo_card_ids = {q.card_id for q in result.questions if q.source == "algo"}
        assert "card-0" not in algo_card_ids

    async def test_returns_fewer_questions_when_no_fallback_types_available(self):
        cards = make_pool(8)
        provider = FakeProvider(raw=_raw_questions(["card-0"]))

        result = await generate_ai_questions(
            provider, cards, ["cloze"], ai_count=3, fallback_types=[], rng=Random(1)
        )

        assert result.error is None
        assert result.ai_count == 1
        assert len(result.questions) == 1

    async def test_provider_failure_is_captured_not_raised(self):
        cards = make_pool(8)
        provider = FakeProvider(error=RuntimeError("provider boom"))

        result = await generate_ai_questions(
            provider, cards, ["cloze"], ai_count=3, fallback_types=[], rng=Random(1)
        )

        assert result.error == "provider boom"
        assert result.questions == []
        assert result.ai_count == 0

    async def test_provider_failure_still_triggers_backfill(self):
        cards = make_pool(8)
        provider = FakeProvider(error=RuntimeError("provider boom"))

        result = await generate_ai_questions(
            provider, cards, ["cloze"], ai_count=3, fallback_types=["en_to_vi"], rng=Random(1)
        )

        assert result.error == "provider boom"
        assert result.ai_count == 0
        assert len(result.questions) == 3
        assert all(question.source == "algo" for question in result.questions)

    async def test_garbage_output_is_handled_gracefully(self):
        cards = make_pool(8)
        provider = FakeProvider(raw="this is not json at all")

        result = await generate_ai_questions(
            provider, cards, ["cloze"], ai_count=3, fallback_types=["en_to_vi"], rng=Random(1)
        )

        assert result.error is None
        assert result.ai_count == 0
        assert len(result.rejected) == 1
        assert len(result.questions) == 3
        assert all(question.source == "algo" for question in result.questions)
