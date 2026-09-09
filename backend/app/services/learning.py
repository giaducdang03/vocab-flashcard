from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.card import Card, CardLearnEvent


def apply_learned_state(db: AsyncSession, card: Card, is_learned: bool) -> None:
    """Change the card's learned status and record event history.

    Only creates an event when the status actually changes, so calling multiple
    times with the same value will not generate duplicate events.

    Uses db.add(...) instead of card.learn_events.append(...): in async SQLAlchemy,
    touching a persistent object's collection triggers lazy load and raises MissingGreenlet.

    Note: card must have an `id` (i.e., already flushed) before calling this function.
    """
    if card.is_learned == is_learned:
        return

    card.is_learned = is_learned
    db.add(
        CardLearnEvent(
            card_id=card.id,
            event_type="learned" if is_learned else "unlearned",
        )
    )


def calculate_streak(learned_dates: set[date], today: date) -> int:
    """Count consecutive days with at least one learned word, counting backward from today.

    If no words were learned today, starts counting from yesterday to prevent the
    streak from breaking mid-day.
    """
    cursor = today if today in learned_dates else today - timedelta(days=1)
    streak = 0
    while cursor in learned_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak
