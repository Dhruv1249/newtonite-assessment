"""Authentication and token generation service.

Handles secure password hashing, verification, and JSON Web Token issuance.
"""

from datetime import datetime, timedelta, timezone
from typing import Any
import uuid
import bcrypt
import jwt

from app.config import settings


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt.

    Args:
        password: Plaintext password string.

    Returns:
        str: Secure bcrypt password hash decoded to utf-8.
    """
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed_bytes = bcrypt.hashpw(password_bytes, salt)
    return hashed_bytes.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored bcrypt hash.

    Args:
        plain_password: Plaintext candidate password.
        hashed_password: Stored bcrypt hash string.

    Returns:
        bool: True if password matches the hash, False otherwise.
    """
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def create_access_token(
    user_id: uuid.UUID,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """Generate a signed JWT access token for an authenticated user.

    Args:
        user_id: Unique user identifier to encode as subject claim.
        expires_delta: Optional custom duration; defaults to configured setting.
        extra_claims: Optional supplementary payload claims.

    Returns:
        str: Encoded JWT string.
    """
    now = datetime.now(timezone.utc)
    expiration = now + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "iat": now,
        "exp": expiration,
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a signed JWT access token.

    Args:
        token: Encoded JWT string.

    Returns:
        dict[str, Any]: Decoded payload claims dictionary.

    Raises:
        jwt.PyJWTError: If token is expired, invalid, or forged.
    """
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
