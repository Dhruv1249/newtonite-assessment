"""Centralized application configuration.

All environment variable access must happen exclusively through this module.
Missing required environment variables will raise an immediate validation error
and terminate startup.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and environment files.

    Attributes:
        database_url: Asynchronous PostgreSQL database connection URL.
        jwt_secret_key: Secret key used for signing and verifying JWT tokens.
        gemini_api_key: Google Gemini API key for embeddings and completions.
        jwt_algorithm: Encryption algorithm for JWT tokens.
        jwt_access_token_expire_minutes: Validity duration for access tokens.
    """

    database_url: str
    jwt_secret_key: str
    gemini_api_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
