import random

import pytest

from app.services import quiz_generator as qg
from tests.factories import make_card, make_pool


class TestComputeCapacity:
    def test_translation_types_can_use_every_card(self):
        cards = make_pool(6)

        capacity = qg.compute_capacity(cards, ["en_to_vi", "vi_to_en"])

        assert capacity == {"en_to_vi": 6, "vi_to_en": 6}

    def test_synonym_type_only_counts_vocab_cards_with_synonyms(self):
        cards = make_pool(6, synonyms_for={0, 1, 2})

        capacity = qg.compute_capacity(cards, ["synonym"])

        assert capacity == {"synonym": 3}

    def test_collocation_never_counts_for_synonym_even_with_synonyms(self):
        cards = make_pool(4)
        cards.append(make_card(9, card_type="collocation", synonyms=["syn9"]))

        capacity = qg.compute_capacity(cards, ["synonym"])

        assert capacity == {"synonym": 0}

    def test_pool_below_minimum_has_zero_capacity(self):
        cards = make_pool(3)

        capacity = qg.compute_capacity(cards, ["en_to_vi"])

        assert capacity == {"en_to_vi": 0}


class TestGenerateTranslationQuestions:
    def test_returns_requested_number_of_questions(self):
        questions = qg.generate_questions(
            make_pool(10), ["en_to_vi"], 5, rng=random.Random(1)
        )
        assert len(questions) == 5

    def test_every_question_has_four_distinct_options(self):
        questions = qg.generate_questions(
            make_pool(10), ["en_to_vi"], 5, rng=random.Random(2)
        )
        for question in questions:
            assert len(question.options) == 4
            assert len({option.lower() for option in question.options}) == 4

    def test_correct_index_points_at_the_card_meaning(self):
        cards = make_pool(10)
        by_id = {card.id: card for card in cards}
        questions = qg.generate_questions(
            cards, ["en_to_vi"], 10, rng=random.Random(3)
        )
        for question in questions:
            card = by_id[question.card_id]
            assert question.options[question.correct_index] == card.back_text
            assert question.prompt_text == card.front_text
            assert question.prompt_phonetic == card.front_phonetic

    def test_vi_to_en_reverses_prompt_and_answer(self):
        cards = make_pool(10)
        by_id = {card.id: card for card in cards}
        questions = qg.generate_questions(
            cards, ["vi_to_en"], 10, rng=random.Random(4)
        )
        for question in questions:
            card = by_id[question.card_id]
            assert question.prompt_text == card.back_text
            assert question.prompt_phonetic is None
            assert question.options[question.correct_index] == card.front_text

    def test_no_card_is_reused_within_one_type(self):
        questions = qg.generate_questions(
            make_pool(8), ["en_to_vi"], 8, rng=random.Random(5)
        )
        card_ids = [question.card_id for question in questions]
        assert len(card_ids) == len(set(card_ids))

    def test_request_larger_than_capacity_is_capped(self):
        questions = qg.generate_questions(
            make_pool(6), ["en_to_vi"], 50, rng=random.Random(6)
        )
        assert len(questions) == 6

    def test_pool_below_four_cards_is_rejected(self):
        with pytest.raises(ValueError, match="at least 4 cards"):
            qg.generate_questions(make_pool(3), ["en_to_vi"], 2, rng=random.Random(7))

    def test_no_question_type_selected_is_rejected(self):
        with pytest.raises(ValueError, match="at least one question type"):
            qg.generate_questions(make_pool(8), [], 2, rng=random.Random(8))

    def test_cards_with_duplicate_meanings_do_not_produce_ambiguous_options(self):
        cards = make_pool(6)
        cards[1].back_text = cards[0].back_text  # Hai card cùng nghĩa
        questions = qg.generate_questions(
            cards, ["en_to_vi"], 6, rng=random.Random(9)
        )
        for question in questions:
            assert len({option.lower() for option in question.options}) == 4
