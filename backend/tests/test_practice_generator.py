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


class TestFilterCardsByPool:
    def test_pool_all_returns_every_card(self):
        cards = make_pool(6, learned_for={0, 1})

        assert qg.filter_cards_by_pool(cards, "all") == list(cards)

    def test_pool_unlearned_keeps_only_cards_not_marked_learned(self):
        cards = make_pool(6, learned_for={0, 1})

        result = qg.filter_cards_by_pool(cards, "unlearned")

        assert [card.id for card in result] == ["card-2", "card-3", "card-4", "card-5"]

    def test_pool_learned_keeps_only_cards_marked_learned(self):
        cards = make_pool(6, learned_for={0, 1})

        result = qg.filter_cards_by_pool(cards, "learned")

        assert [card.id for card in result] == ["card-0", "card-1"]

    def test_pool_learned_on_a_session_with_nothing_learned_is_empty(self):
        cards = make_pool(6)

        assert qg.filter_cards_by_pool(cards, "learned") == []

    def test_unknown_pool_raises(self):
        cards = make_pool(6)

        with pytest.raises(ValueError, match="Unknown practice pool"):
            qg.filter_cards_by_pool(cards, "mastered")

    def test_all_three_pool_names_are_exported(self):
        assert qg.PRACTICE_POOLS == ("all", "unlearned", "learned")


class TestPracticeDistractorPool:
    def test_two_card_pool_still_works_when_distractors_come_from_the_session(self):
        session_cards = make_pool(10)
        practice_cards = session_cards[:2]

        questions = qg.generate_practice_questions(
            practice_cards,
            ["en_to_vi"],
            rng=random.Random(21),
            distractor_pool=session_cards,
        )

        assert len(questions) == 2
        for question in questions:
            assert len(question.options) == 4
            assert len(set(question.options)) == 4

    def test_questions_only_cover_the_question_pool(self):
        session_cards = make_pool(10)
        practice_cards = session_cards[3:6]

        questions = qg.generate_practice_questions(
            practice_cards,
            ["en_to_vi", "vi_to_en"],
            rng=random.Random(22),
            distractor_pool=session_cards,
        )

        assert sorted(q.card_id for q in questions) == ["card-3", "card-4", "card-5"]

    def test_distractors_are_drawn_from_the_distractor_pool(self):
        session_cards = make_pool(10)
        practice_cards = session_cards[:2]
        allowed = {card.back_text for card in session_cards}

        questions = qg.generate_practice_questions(
            practice_cards,
            ["en_to_vi"],
            rng=random.Random(23),
            distractor_pool=session_cards,
        )

        for question in questions:
            assert set(question.options) <= allowed

    def test_distractor_pool_below_minimum_raises(self):
        session_cards = make_pool(3)
        practice_cards = session_cards[:1]

        with pytest.raises(ValueError, match="at least 4 cards"):
            qg.generate_practice_questions(
                practice_cards,
                ["en_to_vi"],
                rng=random.Random(24),
                distractor_pool=session_cards,
            )

    def test_omitting_distractor_pool_keeps_the_old_behaviour(self):
        cards = make_pool(8)

        with_default = qg.generate_practice_questions(
            cards, ["en_to_vi"], rng=random.Random(25)
        )
        with_explicit = qg.generate_practice_questions(
            cards, ["en_to_vi"], rng=random.Random(25), distractor_pool=cards
        )

        signature = lambda deck: [(q.card_id, tuple(q.options)) for q in deck]
        assert signature(with_default) == signature(with_explicit)

    def test_distractor_pool_at_minimum_boundary_works(self):
        """Test distractor pool with exactly MIN_POOL_SIZE cards (boundary condition)."""
        session_cards = make_pool(4)  # Exactly MIN_POOL_SIZE
        practice_cards = session_cards[:2]

        questions = qg.generate_practice_questions(
            practice_cards,
            ["en_to_vi"],
            rng=random.Random(26),
            distractor_pool=session_cards,
        )

        assert len(questions) == 2
        for question in questions:
            assert len(question.options) == 4
            assert len(set(question.options)) == 4
