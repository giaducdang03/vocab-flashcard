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
