"""Unit tests for auth service authenticate_user."""
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException, status
import pytest

from app.services.auth import authenticate_user, hash_password


class FakeUser:
    """Fake User model for testing."""
    def __init__(self, id: str, email: str, password_hash: str | None, display_name: str, role: str = "user"):
        self.id = id
        self.email = email
        self.password_hash = password_hash
        self.display_name = display_name
        self.role = role


class TestAuthenticateUser:
    """Tests for authenticate_user with various password_hash states."""

    @pytest.mark.asyncio
    async def test_unknown_email_returns_401(self):
        """Unknown email should raise 401 Unauthorized."""
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute.return_value = result

        with pytest.raises(HTTPException) as exc_info:
            await authenticate_user(db, "unknown@example.com", "password123")

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_correct_password_returns_user(self):
        """Correct password should return the user."""
        password = "secret123"
        user = FakeUser(
            id="user-1",
            email="test@example.com",
            password_hash=hash_password(password),
            display_name="Test User"
        )

        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = user
        db.execute.return_value = result

        authenticated_user = await authenticate_user(db, "test@example.com", password)
        assert authenticated_user.id == "user-1"
        assert authenticated_user.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_wrong_password_returns_401(self):
        """Wrong password should raise 401 Unauthorized."""
        password = "secret123"
        user = FakeUser(
            id="user-1",
            email="test@example.com",
            password_hash=hash_password(password),
            display_name="Test User"
        )

        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = user
        db.execute.return_value = result

        with pytest.raises(HTTPException) as exc_info:
            await authenticate_user(db, "test@example.com", "wrong_password")

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_google_only_user_cannot_login_with_password(self):
        """Google-only user (null password_hash) should reject password login with 401."""
        # This is the key test - when password_hash is None, we should get 401, not exception from passlib
        user = FakeUser(
            id="user-1",
            email="google@example.com",
            password_hash=None,  # Google-only account
            display_name="Google User"
        )

        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = user
        db.execute.return_value = result

        # Without the fix, this will raise TypeError from passlib.verify(password, None)
        # With the fix, this will raise HTTPException with 401
        with pytest.raises(HTTPException) as exc_info:
            await authenticate_user(db, "google@example.com", "anypassword")

        assert exc_info.value.status_code == 401
