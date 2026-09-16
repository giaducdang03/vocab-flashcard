import json
import random

import pytest

from app.services.ai import quiz_prompt
from tests.factories import make_pool


def _payload_of(user: str) -> dict:
    """Bóc lại JSON đã nhúng trong user prompt."""
    return json.loads(user[user.index("{") : user.rindex("}") + 1])


class TestBuildPrompt:
    def test_rejects_legacy_question_types(self):
        cards = make_pool(5)

        with pytest.raises(ValueError, match="en_to_vi"):
            quiz_prompt.build_prompt(cards, ["cloze", "en_to_vi"], 4, max_cards=10)

    def test_rejects_empty_type_list(self):
        cards = make_pool(5)

        with pytest.raises(ValueError):
            quiz_prompt.build_prompt(cards, [], 4, max_cards=10)

    def test_samples_cards_down_to_the_limit(self):
        cards = make_pool(50)

        _, user = quiz_prompt.build_prompt(
            cards, ["cloze"], 4, max_cards=10, rng=random.Random(1)
        )

        assert len(_payload_of(user)["cards"]) == 10

    def test_keeps_every_card_when_under_the_limit(self):
        cards = make_pool(6)

        _, user = quiz_prompt.build_prompt(cards, ["cloze"], 4, max_cards=10)

        payload = _payload_of(user)
        assert len(payload["cards"]) == 6
        assert payload["question_count"] == 4
        assert payload["question_types"] == ["cloze"]

    def test_card_payload_carries_the_fields_the_model_needs(self):
        cards = make_pool(4, synonyms_for={0})

        _, user = quiz_prompt.build_prompt(cards, ["context"], 2, max_cards=10)

        first = _payload_of(user)["cards"][0]
        assert set(first) == {
            "card_id",
            "front_text",
            "front_phonetic",
            "back_text",
            "example",
            "synonyms",
        }


def _raw(questions: list[dict]) -> str:
    return json.dumps({"questions": questions}, ensure_ascii=False)


def _good_question(card_id: str = "card-0") -> dict:
    return {
        "card_id": card_id,
        "question_type": "cloze",
        "prompt_text": "The harvest was ___ this year.",
        "options": ["word0", "word1", "word2", "word3"],
        "correct_index": 0,
        "explanation": "word0 nghĩa là dồi dào, hợp với vụ mùa bội thu.",
    }


class TestParseAndValidate:
    def test_accepts_a_well_formed_question(self):
        cards = make_pool(4)

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([_good_question()]), cards, ["cloze"]
        )

        assert rejected == []
        assert len(questions) == 1
        assert questions[0].card_id == "card-0"
        assert questions[0].correct_index == 0
        assert questions[0].source == "ai"
        assert questions[0].explanation.startswith("word0")

    def test_tolerates_code_fence_and_surrounding_prose(self):
        cards = make_pool(4)
        raw = "Đây là đề của bạn:\n```json\n" + _raw([_good_question()]) + "\n```\nHết."

        questions, _ = quiz_prompt.parse_and_validate(raw, cards, ["cloze"])

        assert len(questions) == 1

    def test_broken_json_yields_no_questions(self):
        cards = make_pool(4)

        questions, rejected = quiz_prompt.parse_and_validate("not json", cards, ["cloze"])

        assert questions == []
        assert len(rejected) == 1

    def test_missing_questions_array_yields_no_questions(self):
        cards = make_pool(4)

        questions, rejected = quiz_prompt.parse_and_validate('{"data": []}', cards, ["cloze"])

        assert questions == []
        assert len(rejected) == 1

    def test_rejects_duplicate_options(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["options"] = ["word0", "Word0", "word2", "word3"]

        questions, rejected = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []
        assert "trùng" in rejected[0]

    def test_rejects_wrong_option_count(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["options"] = ["word0", "word1", "word2"]

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_rejects_empty_option(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["options"] = ["word0", "  ", "word2", "word3"]

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_rejects_correct_index_out_of_range(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["correct_index"] = 4

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_rejects_boolean_correct_index(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["correct_index"] = True

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_rejects_empty_explanation(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["explanation"] = "   "

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_rejects_cloze_without_a_blank(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["prompt_text"] = "The harvest was good this year."

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_context_question_needs_no_blank(self):
        cards = make_pool(4)
        item = _good_question()
        item["question_type"] = "context"
        item["prompt_text"] = "Which word fits a plentiful harvest?"

        questions, _ = quiz_prompt.parse_and_validate(_raw([item]), cards, ["context"])

        assert len(questions) == 1

    def test_rejects_unknown_card_id(self):
        cards = make_pool(4)

        questions, _ = quiz_prompt.parse_and_validate(
            _raw([_good_question(card_id="card-999")]), cards, ["cloze"]
        )

        assert questions == []

    def test_rejects_question_type_that_was_not_requested(self):
        cards = make_pool(4)
        bad = _good_question()
        bad["question_type"] = "context"

        questions, _ = quiz_prompt.parse_and_validate(_raw([bad]), cards, ["cloze"])

        assert questions == []

    def test_rejects_the_same_card_twice(self):
        cards = make_pool(4)

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([_good_question(), _good_question()]), cards, ["cloze"]
        )

        assert len(questions) == 1
        assert len(rejected) == 1

    def test_keeps_good_questions_and_drops_bad_ones(self):
        cards = make_pool(4)
        bad = _good_question(card_id="card-1")
        bad["correct_index"] = 9

        questions, rejected = quiz_prompt.parse_and_validate(
            _raw([_good_question(), bad]), cards, ["cloze"]
        )

        assert len(questions) == 1
        assert len(rejected) == 1
