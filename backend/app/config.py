"""Centralized application configuration.

All environment variable access must happen exclusively through this module.
Safe evaluation defaults ensure the platform operates seamlessly out of the box
even when no external environment variables or API keys are configured.
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and environment files.

    Attributes:
        database_url: Asynchronous PostgreSQL database connection URL.
        jwt_secret_key: Secret key used for signing and verifying JWT tokens.
        gemini_api_key: Optional Google Gemini API key for embeddings and completions.
        jwt_algorithm: Encryption algorithm for JWT tokens.
        jwt_access_token_expire_minutes: Validity duration for access tokens.
    """

    database_url: str = (
        "postgresql+asyncpg://opflow_user:opflow_password@localhost:5432/opflow_db"
    )
    jwt_secret_key: str = (
        "opflow_default_evaluation_secret_key_98374298714092384092384092834092"
    )
    gemini_api_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        """Normalize database connection protocol for asyncpg driver.

        Args:
            value: Raw database connection string.

        Returns:
            str: Connection URL normalized to postgresql+asyncpg.
        """
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+asyncpg://", 1)
        return value

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
