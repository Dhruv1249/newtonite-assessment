"""Authentication request and response validation schemas."""

from datetime import datetime
import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegisterRequest(BaseModel):
    """Payload for user account registration.

    Attributes:
        email: Valid email address.
        password: Plaintext password with minimum length requirement.
        display_name: Human readable name.
    """

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=2, max_length=255)


class UserLoginRequest(BaseModel):
    """Payload for user authentication.

    Attributes:
        email: User email address.
        password: User password.
    """

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Bearer token pair response.

    Attributes:
        access_token: Encoded JWT access token.
        token_type: Token type identifier, typically bearer.
    """

    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Public user profile data.

    Attributes:
        id: Unique user identifier.
        email: User email address.
        display_name: Display name.
        created_at: Account creation timestamp.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str
    created_at: datetime
