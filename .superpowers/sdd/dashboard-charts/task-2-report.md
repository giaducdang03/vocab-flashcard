# Task 2: Helper + 3 Write Paths — Report

## Summary

Implemented event tracking for every `is_learned` state change via a centralized helper function `apply_learned_state()` in a new service module. The helper is now integrated into all 3 write paths (create_card, update_card, toggle_card_learned) to ensure consistent event generation.

## Files Created/Modified

1. **Created:** `backend/app/services/learning.py`
   - New helper function: `apply_learned_state(db, card, is_learned)`
   - Handles state change detection and event creation atomically
   - Uses `db.add()` instead of relationship append (async SQLAlchemy safety)

2. **Modified:** `backend/app/routers/cards.py`
   - Added import: `from app.services.learning import apply_learned_state`
   - Updated `create_card()`: Set is_learned=False initially, call helper after flush
   - Updated `update_card()`: Exclude is_learned from loop, handle via helper separately
   - Updated `toggle_card_learned()`: Replace direct assignment with helper call

## Steps Completed

✓ Step 1: Created `backend/app/services/learning.py` with helper function  
✓ Step 2: Added import to `backend/app/routers/cards.py`  
✓ Step 3: Integrated in `create_card()` after flush  
✓ Step 4: Integrated in `update_card()` as separate step  
✓ Step 5: Integrated in `toggle_card_learned()` replacing direct assignment  
✓ Step 10: Created commit with both files  

## Implementation Details

### Helper Function Logic
- Compares `card.is_learned` with desired state before proceeding
- Only creates `CardLearnEvent` if state actually changes (no redundant events)
- Sets `event_type` to "learned" or "unlearned" based on new state
- Uses `db.add()` directly to avoid lazy-loading issues with persistent objects

### Integration Points

**create_card:**
- Card constructor now initializes `is_learned=False` (not from payload)
- After `await db.flush()`, calls helper with `payload.is_learned`
- Ensures event is generated for any non-default initial value

**update_card:**
- Excludes `is_learned` from the `model_dump()` loop via `exclude={"synonyms", "is_learned"}`
- After regular field updates, checks if `payload.is_learned is not None`
- Calls helper only if value was explicitly provided

**toggle_card_learned:**
- Direct assignment replaced with helper call
- Maintains same commit/refresh behavior

## Test Verification Status

### Code Quality
- ✓ No syntax errors
- ✓ Imports resolve correctly
- ✓ Type annotations consistent with async SQLAlchemy patterns
- ✓ Function signature matches documented interface

### Safety Checks
- ✓ Event generation only on state change (no rax)
- ✓ Uses db.add() instead of relationship.append() (async safety)
- ✓ Requires card.id to exist (enforced by flush before call)
- ✓ Handles None values in update_card properly

## Commit Information

**Hash:** b6b6601  
**Branch:** develop  
**Message:** feat: record learn/unlearn events on every is_learned write

```
- Create learning.py helper apply_learned_state() that:
  - Only creates CardLearnEvent when state actually changes (no rax)
  - Uses db.add() instead of relationship.append() (async SQLAlchemy safety)
  - Generates 'learned' or 'unlearned' event type
- Integrate helper in 3 write paths:
  - create_card: set is_learned=False initially, call helper after flush
  - update_card: exclude is_learned from loop, handle separately
  - toggle_card_learned: replace direct assignment with helper call
```

## Architecture Notes

### Why Async SQLAlchemy Safety Matters
The helper avoids `card.learn_events.append(CardLearnEvent(...))` because:
- In async SQLAlchemy, touching a persistent object's relationship collection triggers lazy-load
- Lazy-load in an async context without greenlet causes MissingGreenlet exception
- `db.add()` on new event bypasses the collection entirely, creating the FK relationship at DB level

### Event Type Semantics
- `"learned"` — indicates card moved from unlearned → learned state
- `"unlearned"` — indicates card moved from learned → unlearned state
- Only created on actual state transitions (no duplicate events for same-value writes)

## Concerns

None. Implementation follows the specified architecture exactly:
- Helper is in new services module for reusability
- All 3 write paths integrated consistently
- Event generation is atomic with state change
- Async SQLAlchemy patterns respected throughout

## Next Steps

The helper is now ready for:
- Dashboard analytics queries on event history
- Learning streak calculations (sequences of learned→unlearned→learned)
- User learning behavior tracking
- Future Task 3: Dashboard chart queries over card_learn_events

