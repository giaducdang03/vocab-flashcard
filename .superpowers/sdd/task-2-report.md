# Task 2 Report

**Status:** DONE

**Tests:**
```
============================= test session starts =============================
platform win32 -- Python 3.13.7, pytest-8.3.3, pluggy-1.6.0
collected 13 items

tests/test_quiz_generator.py::TestComputeCapacity::test_translation_types_can_use_every_card PASSED [  7%]
tests/test_quiz_generator.py::TestComputeCapacity::test_synonym_type_only_counts_vocab_cards_with_synonyms PASSED [ 15%]
tests/test_quiz_generator.py::TestComputeCapacity::test_collocation_never_counts_for_synonym_even_with_synonyms PASSED [ 23%]
tests/test_quiz_generator.py::TestComputeCapacity::test_pool_below_minimum_has_zero_capacity PASSED [ 30%]
tests/test_quiz_generator.py::TestGenerateTranslationQuestions::test_returns_requested_number_of_questions PASSED [ 38%]
tests/test_quiz_generator.py::TestGenerateTranslationQuestions::test_every_question_has_four_distinct_options PASSED [ 46%]
tests/test_quiz_generator.py::TestGenerateTranslationQuestions::test_correct_index_points_at_the_card_meaning PASSED [ 53%]
tests/test_quiz_generator.py::TestGenerateTranslationQuestions::test_vi_to_en_reverses_prompt_and_answer PASSED [ 61%]
tests/test_quiz_generator.py::TestGenerateTranslationQuestions::test_no_card_is_reused_within_one_type PASSED [ 69%]
tests/test_quiz_generator.py::TestGenerateTranslationQuestions::test_request_larger_than_capacity_is_capped PASSED [ 76%]
tests/test_quiz_generator.py::TestGenerateTranslationQuestions::test_pool_below_four_cards_is_rejected PASSED [ 84%]
tests/test_quiz_generator.py::TestGenerateTranslationQuestions::test_no_question_type_selected_is_rejected PASSED [ 92%]
tests/test_quiz_generator.py::TestGenerateTranslationQuestions::test_cards_with_duplicate_meanings_do_not_produce_ambiguous_options PASSED [100%]

============================= 13 passed in 0.05s ==============================
```

**Commits:** 81d8a63

**Concerns:** None

## Summary

Successfully implemented Task 2: quiz question generation for English-to-Vietnamese (en_to_vi) and Vietnamese-to-English (vi_to_en) translation types.

### Implementation Details

#### Added to `backend/app/services/quiz_generator.py`:

1. **GeneratedQuestion dataclass** - Represents a generated multiple-choice question with:
   - card_id, question_type, prompt_text, prompt_phonetic, options (list of 4 distinct answers), correct_index

2. **Helper functions:**
   - `_normalize(text)` - Normalizes text for case-insensitive comparison
   - `_distractor_field(question_type)` - Returns the field to use for distractors based on question type
   - `_answer_of(card, question_type)` - Gets the correct answer for a card
   - `_prompt_of(card, question_type)` - Gets the prompt and phonetic for a card
   - `_build_options(card, question_type, pool, rng)` - Builds four distinct options with guaranteed correct answer
   - `_distribute(question_count, capacity, rng)` - Distributes question count across types

3. **Main function:**
   - `generate_questions(cards, question_types, question_count, rng=None)` - Generates quiz questions

#### Added to `backend/tests/test_quiz_generator.py`:

9 new test cases covering:
- Returning correct number of questions
- Ensuring all four options are distinct
- Verifying correct_index points to the right answer
- Testing vi_to_en reverses prompt and answer
- Preventing card reuse within a question type
- Capping requests larger than capacity
- Rejecting pools below 4 cards
- Rejecting empty question_types list
- Handling duplicate meanings in cards

### Key Behaviors

- **en_to_vi:** Prompt is front_text (with phonetic), answer is back_text, distractors are back_texts from other cards
- **vi_to_en:** Prompt is back_text (no phonetic), answer is front_text, distractors are front_texts from other cards
- All 4 options are always distinct (case-insensitive comparison)
- No card is reused within the same question type in a single generation
- Gracefully caps question count to available capacity
- Handles duplicate meanings by deduplicating distractors
