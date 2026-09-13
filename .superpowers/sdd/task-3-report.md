# Task 3: Dạng `synonym` + trộn nhiều dạng

## Summary
Successfully implemented synonym question type support and comprehensive tests for mixing multiple question types.

## What was completed

### 1. Implementation Changes
**File: `backend/app/services/quiz_generator.py`**

- **Enhanced `_answer_of` function**: 
  - Added `rng` parameter (optional) to support random selection
  - Added synonym case that returns `rng.choice([syn.word for syn in card.synonyms])`
  - Allows random selection of synonyms as correct answers

- **Enhanced `_build_options` function**:
  - Added "banned values" logic to exclude problematic distractors
  - For synonym questions, bans all synonyms of the current card (not just the chosen answer)
  - Ensures distractors are truly different from any synonym
  - Updated to pass `rng` to `_answer_of`

- **Enhanced `generate_questions` function**:
  - Uses full card pool for distractor selection in synonym questions
  - Uses eligible_cards for translation questions (existing behavior)
  - This ensures sufficient distractor options for synonym questions

### 2. Test Cases Added
**File: `backend/tests/test_quiz_generator.py`**

#### TestGenerateSynonymQuestions (3 tests)
1. **test_correct_answer_is_a_synonym_of_the_prompt_card**
   - Verifies correct answer is from the card's synonyms
   - Checks prompt_text matches card's front_text
   - Tests with 4 cards having synonyms, generating 4 questions

2. **test_distractors_are_never_synonyms_of_the_same_card**
   - Ensures distractor words never include card's own synonyms
   - Also ensures card's front_text is not a distractor
   - Uses manual synonym setup for precise control

3. **test_cards_without_synonyms_are_skipped**
   - Only cards with synonyms should generate synonym questions
   - Tests with 8 cards, only 2 having synonyms
   - Verifies exactly 2 questions generated from 2 eligible cards

#### TestMixingQuestionTypes (2 tests)
1. **test_question_count_is_split_across_selected_types**
   - Verifies equal distribution across 3 question types
   - Requests 9 questions → expects 3 en_to_vi, 3 vi_to_en, 3 synonym
   - All 12 cards have synonyms to ensure full capacity

2. **test_a_starved_type_spills_over_to_the_others**
   - Tests behavior when one type has limited capacity
   - Only 2 cards have synonyms (capacity=2) vs 12 en_to_vi/vi_to_en capacity
   - Requests 9 questions → gets 2 synonym, 7 split between translation types
   - Demonstrates spillover mechanism for capacity constraints

### 3. Test Results
```
✓ All 18 tests pass (13 existing + 5 new)
  - 4 TestComputeCapacity tests
  - 9 TestGenerateTranslationQuestions tests  
  - 3 TestGenerateSynonymQuestions tests (NEW)
  - 2 TestMixingQuestionTypes tests (NEW)
```

## Key Implementation Details

### Synonym Question Flow
```
1. Prompt: card.front_text + card.front_phonetic (same as en_to_vi)
2. Answer: random synonym from card.synonyms
3. Distractors: front_text from other cards
   - Excludes: chosen synonym, card's front_text, all other synonyms
   - Drawn from entire pool (not just eligible cards)
```

### Distractor Pool Strategy
- **Translation questions**: Use eligible_cards pool (all cards are eligible anyway)
- **Synonym questions**: Use full card pool to ensure 3+ distractor candidates
  - This accommodates pools with few synonym-eligible cards

### Banned Values for Synonyms
```python
banned = {
    normalized(answer),           # The chosen synonym
    normalized(card.front_text),  # Card's own word
    normalized(all_synonyms)      # All other synonyms of this card
}
```

## Files Modified
- `backend/app/services/quiz_generator.py` - Core implementation
- `backend/tests/test_quiz_generator.py` - Test suite

## Git Commit
```
cefd21d test: cover synonym questions and multi-type distribution

- Add synonym question type support to quiz_generator
- Implement _answer_of to return random synonym for synonym questions
- Filter distractors to exclude synonyms of the current card
- Use full card pool for distractors in synonym questions
- Add 3 tests for synonym question generation
- Add 2 tests for mixing multiple question types and capacity spillover
```

## Testing Command
```bash
cd backend
.venv\Scripts\python -m pytest tests/test_quiz_generator.py -v
```

Result: **18 passed in 0.04s** ✓
