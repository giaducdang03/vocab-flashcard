import random

import pytest

from app.services import quiz_generator as qg
from tests.factories import make_card, make_pool


class TestGeneratePracticeQuestions:
    def test_every_card_produces_exactly_one_question(self):
        cards = make_pool(8)

        questions = qg.generate_practice_questions(
            cards, ["en_to_vi", "vi_to_en"], rng=random.Random(1)
        )

        assert len(questions) == 8
        assert sorted(q.card_id for q in questions) == sorted(c.id for c in cards)

    def test_question_type_always_comes_from_the_requested_set(self):
        cards = make_pool(10, synonyms_for={0, 1, 2})

        questions = qg.generate_practice_questions(
            cards, ["vi_to_en"], rng=random.Random(2)
        )

        assert {q.question_type for q in questions} == {"vi_to_en"}

    def test_synonym_only_lands_on_vocab_cards_that_have_synonyms(self):
        cards = make_pool(10, synonyms_for={0, 1, 2})
        with_synonyms = {"card-0", "card-1", "card-2"}

        questions = qg.generate_practice_questions(
            cards, ["en_to_vi", "vi_to_en", "synonym"], rng=random.Random(3)
        )

        synonym_card_ids = {q.card_id for q in questions if q.question_type == "synonym"}
        assert synonym_card_ids <= with_synonyms

    def test_card_without_synonyms_falls_back_to_another_requested_type(self):
        cards = make_pool(8, synonyms_for={0})

        questions = qg.generate_practice_questions(
            cards, ["synonym", "en_to_vi"], rng=random.Random(4)
        )

        # Cả 8 card đều ra câu: 7 card không synonym rơi về en_to_vi.
        assert len(questions) == 8
        by_id = {q.card_id: q for q in questions}
        assert by_id["card-3"].question_type == "en_to_vi"

    def test_card_eligible_for_nothing_is_skipped(self):
        cards = make_pool(6)
        cards.append(make_card(9, card_type="collocation"))

        questions = qg.generate_practice_questions(
            cards, ["synonym"], rng=random.Random(5)
        )

        assert questions == []

    def test_options_are_four_distinct_values_with_correct_index_pointing_at_answer(self):
        cards = make_pool(8)

        questions = qg.generate_practice_questions(
            cards, ["en_to_vi"], rng=random.Random(6)
        )

        by_id = {q.card_id: q for q in questions}
        for card in cards:
            question = by_id[card.id]
            assert len(question.options) == 4
            assert len(set(question.options)) == 4
            assert question.options[question.correct_index] == card.back_text

    def test_prompt_matches_the_direction_of_the_question_type(self):
        cards = make_pool(8)

        questions = qg.generate_practice_questions(
            cards, ["vi_to_en"], rng=random.Random(7)
        )

        by_id = {q.card_id: q for q in questions}
        assert by_id["card-2"].prompt_text == "nghia2"
        assert by_id["card-2"].prompt_phonetic is None

    def test_same_seed_gives_the_same_deck_and_different_seeds_differ(self):
        cards = make_pool(12, synonyms_for={0, 1, 2, 3})

        first = qg.generate_practice_questions(
            cards, ["en_to_vi", "vi_to_en", "synonym"], rng=random.Random(11)
        )
        same = qg.generate_practice_questions(
            cards, ["en_to_vi", "vi_to_en", "synonym"], rng=random.Random(11)
        )
        other = qg.generate_practice_questions(
            cards, ["en_to_vi", "vi_to_en", "synonym"], rng=random.Random(99)
        )

        signature = lambda deck: [(q.card_id, q.question_type, tuple(q.options)) for q in deck]
        assert signature(first) == signature(same)
        assert signature(first) != signature(other)

    def test_pool_below_minimum_raises(self):
        cards = make_pool(3)

        with pytest.raises(ValueError, match="at least 4 cards"):
            qg.generate_practice_questions(cards, ["en_to_vi"], rng=random.Random(8))

    def test_empty_question_types_raises(self):
        cards = make_pool(6)

        with pytest.raises(ValueError, match="at least one question type"):
            qg.generate_practice_questions(cards, [], rng=random.Random(9))

    def test_unknown_question_type_raises(self):
        cards = make_pool(6)

        with pytest.raises(ValueError, match="Unknown question type"):
            qg.generate_practice_questions(cards, ["en_to_fr"], rng=random.Random(10))
