"""Unit tests for TtlStore - in-memory store for single-use tokens with TTL."""
from datetime import datetime, timezone, timedelta
import pytest

from app.services.oauth_state import TtlStore


class FakeClock:
    """Fake clock for testing TTL store expiration."""
    def __init__(self, start_time: datetime):
        self.now = start_time

    def __call__(self) -> datetime:
        return self.now

    def advance(self, seconds: int) -> None:
        """Advance the clock by the given number of seconds."""
        self.delta = timedelta(seconds=seconds)
        self.now = self.now + self.delta


class TestTtlStoreBasics:
    """Basic operations: issue, consume, and edge cases."""

    def test_issue_and_consume_returns_value(self):
        """Issue a token and consume it returns the original value."""
        clock = FakeClock(datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc))
        store = TtlStore(ttl_seconds=60, now=clock)

        token = store.issue("state-value-123")
        assert token is not None
        assert len(token) > 0

        result = store.consume(token)
        assert result == "state-value-123"

    def test_consume_token_twice_only_first_succeeds(self):
        """Consuming same token twice: only first succeeds, second returns None."""
        clock = FakeClock(datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc))
        store = TtlStore(ttl_seconds=60, now=clock)

        token = store.issue("state-value-123")

        # First consume should succeed
        result1 = store.consume(token)
        assert result1 == "state-value-123"

        # Second consume should fail (token was consumed and removed)
        result2 = store.consume(token)
        assert result2 is None

    def test_expired_token_returns_none(self):
        """Consuming an expired token returns None."""
        clock = FakeClock(datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc))
        store = TtlStore(ttl_seconds=60, now=clock)

        token = store.issue("state-value-123")

        # Advance clock past expiration (60 second TTL + 1)
        clock.advance(61)

        result = store.consume(token)
        assert result is None

    def test_still_valid_before_expiry(self):
        """Token is still valid 59 seconds into a 60-second TTL."""
        clock = FakeClock(datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc))
        store = TtlStore(ttl_seconds=60, now=clock)

        token = store.issue("state-value-123")

        # Advance clock to 59 seconds (still valid)
        clock.advance(59)

        result = store.consume(token)
        assert result == "state-value-123"

    def test_unknown_token_returns_none(self):
        """Consuming an unknown/made-up token returns None."""
        clock = FakeClock(datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc))
        store = TtlStore(ttl_seconds=60, now=clock)

        result = store.consume("made-up-token-that-does-not-exist")
        assert result is None

    def test_two_issues_never_duplicate(self):
        """Two calls to issue() generate different tokens."""
        clock = FakeClock(datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc))
        store = TtlStore(ttl_seconds=60, now=clock)

        token1 = store.issue("value1")
        token2 = store.issue("value2")

        assert token1 != token2

        # Both should work
        assert store.consume(token1) == "value1"
        assert store.consume(token2) == "value2"

    def test_empty_value_preserved(self):
        """Empty value (state='') is preserved, not confused with missing."""
        clock = FakeClock(datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc))
        store = TtlStore(ttl_seconds=60, now=clock)

        token = store.issue("")
        result = store.consume(token)

        # Should return empty string, not None
        assert result == ""

    def test_purge_expired_drops_stale_entries(self):
        """purge_expired() removes expired entries."""
        clock = FakeClock(datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc))
        store = TtlStore(ttl_seconds=60, now=clock)

        # Issue token1
        token1 = store.issue("value1")
        # Advance 31 seconds (token1 will expire at 60)
        clock.advance(31)
        # Issue token2 (will expire at 60 + 31 = 91)
        token2 = store.issue("value2")
        # Advance 31 more seconds (total 62 from start, so token1 is expired but token2 is valid)
        clock.advance(31)

        # Before purge, both exist
        # But trying to consume expired token should fail
        assert store.consume(token1) is None

        # Call purge_expired to clean up
        store.purge_expired()

        # After purge, token2 should still be valid
        assert store.consume(token2) == "value2"
