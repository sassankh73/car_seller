# Core utilities for the backend (e.g., DB connection, settings)

# In a real app you would configure SQLAlchemy, Alembic, etc.
# For the MVP we keep it minimal.


class Settings:
    PROJECT_NAME: str = "AutoStudio AI"
    VERSION: str = "0.1.0"
    # Add DB URL, secret keys, etc.


settings = Settings()
