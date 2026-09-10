import random
from collections import Counter

import pytest

from app.services import quiz_generator as qg
from tests.factories import FakeSynonym, make_card, make_pool


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


class TestGenerateSynonymQuestions:
    def test_correct_answer_is_a_synonym_of_the_prompt_card(self):
        cards = make_pool(8, synonyms_for={0, 1, 2, 3})
        by_id = {card.id: card for card in cards}

        questions = qg.generate_questions(
            cards, ["synonym"], 4, rng=random.Random(11)
        )

        assert len(questions) == 4
        for question in questions:
            card = by_id[question.card_id]
            assert question.prompt_text == card.front_text
            answer = question.options[question.correct_index]
            assert answer in {synonym.word for synonym in card.synonyms}

    def test_distractors_are_never_synonyms_of_the_same_card(self):
        cards = make_pool(8)
        cards[0].synonyms = [
            FakeSynonym(word="alpha"),
            FakeSynonym(word="beta"),
            FakeSynonym(word="gamma"),
        ]

        questions = qg.generate_questions(
            cards, ["synonym"], 1, rng=random.Random(12)
        )

        question = questions[0]
        wrong = [
            option
            for index, option in enumerate(question.options)
            if index != question.correct_index
        ]
        assert not ({"alpha", "beta", "gamma"} & set(wrong))
        assert cards[0].front_text not in wrong

    def test_cards_without_synonyms_are_skipped(self):
        cards = make_pool(8, synonyms_for={0, 1})

        questions = qg.generate_questions(
            cards, ["synonym"], 8, rng=random.Random(13)
        )

        assert len(questions) == 2
        assert {question.card_id for question in questions} == {"card-0", "card-1"}


class TestMixingQuestionTypes:
    def test_question_count_is_split_across_selected_types(self):
        cards = make_pool(12, synonyms_for=set(range(12)))

        questions = qg.generate_questions(
            cards, ["en_to_vi", "vi_to_en", "synonym"], 9, rng=random.Random(21)
        )

        assert len(questions) == 9
        counts = Counter(question.question_type for question in questions)
        assert counts == {"en_to_vi": 3, "vi_to_en": 3, "synonym": 3}

    def test_a_starved_type_spills_over_to_the_others(self):
        cards = make_pool(12, synonyms_for={0, 1})

        questions = qg.generate_questions(
            cards, ["en_to_vi", "vi_to_en", "synonym"], 9, rng=random.Random(22)
        )

        assert len(questions) == 9
        counts = Counter(question.question_type for question in questions)
        assert counts["synonym"] == 2
        assert counts["en_to_vi"] + counts["vi_to_en"] == 7
