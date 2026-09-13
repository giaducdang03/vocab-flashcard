# Task 1 Report

**Status:** DONE

**Test output:**
```
E:\Project\vocab_flash\backend\.venv\Lib\site-packages\pytest_asyncio\plugin.py:208: PytestDeprecationWarning: The configuration option "asyncio_default_fixture_loop_scope" is unset.
The event loop scope for asynchronous fixtures will default to the fixture caching scope. Future versions of pytest-asyncio will default the loop scope for asynchronous fixtures to function scope. Set the default fixture loop scope explicitly in order to avoid unexpected behavior in the future. Valid fixture loop scopes are: "function", "class", "module", "package", "session"

  warnings.warn(PytestDeprecationWarning(_DEFAULT_FIXTURE_LOOP_SCOPE_UNSET))
============================= test session starts =============================
platform win32 -- Python 3.13.7, pytest-8.3.3, pluggy-1.6.0 -- E:\Project\vocab_flash\backend\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: E:\Project\vocab_flash\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-0.24.0
asyncio: mode=Mode.STRICT, default_loop_scope=None
collecting ... collected 4 items

tests/test_quiz_generator.py::TestComputeCapacity::test_translation_types_can_use_every_card PASSED [ 25%]
tests/test_quiz_generator.py::TestComputeCapacity::test_synonym_type_only_counts_vocab_cards_with_synonyms PASSED [ 50%]
tests/test_quiz_generator.py::TestComputeCapacity::test_collocation_never_counts_for_synonym_even_with_synonyms PASSED [ 75%]
tests/test_quiz_generator.py::TestComputeCapacity::test_pool_below_minimum_has_zero_capacity PASSED [100%]

============================== 4 passed in 0.04s ==============================
```

**Commits:** 547f5dc85de8f7fb0734e4dbe9ecb6c3c6282587

**Concerns:** None

## Summary

Successfully completed all requirements for Task 1:

1. **Modified requirements.txt** - Added pytest==8.3.3 and pytest-asyncio==0.24.0
2. **Created test infrastructure:**
   - `backend/tests/__init__.py` (empty marker file)
   - `backend/tests/factories.py` (FakeSynonym, FakeCard, make_card, make_pool helper functions)
   - `backend/tests/test_quiz_generator.py` (4 test cases for compute_capacity)
3. **Created service module:**
   - `backend/app/services/__init__.py` (package marker)
   - `backend/app/services/quiz_generator.py` (compute_capacity function with _is_eligible helper)
4. **All 4 tests passed** - 100% pass rate in 0.04 seconds
5. **Committed** to develop branch with commit hash 547f5dc85de8f7fb0734e4dbe9ecb6c3c6282587

The implementation correctly handles:
- Translation types (en_to_vi, vi_to_en) can use every card
- Synonym type only counts vocab cards with synonyms
- Collocation cards never count for synonym questions
- Pools below minimum size (4 cards) have zero capacity for all types
