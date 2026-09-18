"""In-memory TTL store for single-use OAuth tokens.

Holds OAuth state tokens and one-time login codes, each with configurable TTL.
In-memory only: when backend scales to multiple workers, this will be swapped
to DB/Redis for shared state across processes.

Note on is True guard: This store holds strings (state and login codes), so
boolean validation is not needed here. However, when other stores hold booleans
(e.g., email_verified flag), we use 'is True' to distinguish True from truthy values.
"""
import secrets
from datetime import datetime, timezone, timedelta
from typing import Callable, Optional


def _utcnow() -> datetime:
    """Get current UTC time."""
    return datetime.now(timezone.utc)


class TtlStore:
    """In-memory store for single-use tokens with time-to-live (TTL).

    Each token is a random URL-safe string that maps to a value and an expiration time.
    Tokens can only be consumed once; after consuming, they are removed from the store.
    Expired tokens return None.

    Args:
        ttl_seconds: Time-to-live in seconds for each token.
        now: Callable that returns current datetime (default: UTC now).
             Used for testing with FakeClock.
    """

    def __init__(self, ttl_seconds: int, now: Callable[[], datetime] = _utcnow):
        self.ttl_seconds = ttl_seconds
        self.now = now
        self._store: dict[str, tuple[str, datetime]] = {}

    def issue(self, value: str) -> str:
        """Create and store a new token for the given value.

        Args:
            value: The value to store (e.g., OAuth state, login code).

        Returns:
            A random URL-safe token string.
        """
        token = secrets.token_urlsafe(32)
        expires_at = self.now() + timedelta(seconds=self.ttl_seconds)
        self._store[token] = (value, expires_at)
        return token

    def consume(self, token: str) -> Optional[str]:
        """Retrieve and remove a token from the store.

        Returns the value if the token exists and has not expired.
        Returns None if the token does not exist or has expired.
        The token is removed whether it was found or expired.

        Args:
            token: The token to consume.

        Returns:
            The stored value, or None if token does not exist or is expired.
        """
        if token not in self._store:
            return None

        value, expires_at = self._store.pop(token)

        # Check if token has expired
        if self.now() >= expires_at:
            return None

        return value

    def purge_expired(self) -> None:
        """Remove all expired tokens from the store."""
        now = self.now()
        expired_tokens = [
            token for token, (_, expires_at) in self._store.items()
            if now >= expires_at
        ]
        for token in expired_tokens:
            del self._store[token]


# Module-level instances for OAuth flow
# OAuth state tokens: short-lived (10 minutes)
state_store = TtlStore(ttl_seconds=600)

# One-time login codes: very short-lived (1 minute)
login_code_store = TtlStore(ttl_seconds=60)
