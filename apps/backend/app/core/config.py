from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", 
        extra="ignore",
        case_sensitive=False
    )
    
    PROJECT_NAME: str = "Kaalay API"
    DATABASE_URL: str
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    JWT_SECRET: str = "super-secret-key"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    W3W_API_KEY: Optional[str] = None
    GOOGLE_MAPS_API_KEY: Optional[str] = None
    # Server-restricted key for server-to-server Google APIs (Roads API).
    # Deliberately separate from GOOGLE_MAPS_API_KEY, which is sent to the browser.
    GOOGLE_MAPS_SERVER_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None

    # Database connection details (fallback)
    DATABASE_HOST: Optional[str] = None
    DATABASE_PORT: Optional[int] = None
    DATABASE_USER: Optional[str] = None
    DATABASE_PASSWORD: Optional[str] = None
    DATABASE_NAME: Optional[str] = None
    PORT: Optional[int] = None

settings = Settings()
