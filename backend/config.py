"""Central configuration loaded from environment variables."""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env when running locally; in Docker the values come from env_file.
load_dotenv()

DATA_DIR = Path(os.getenv("DATA_DIR", "/data"))
PROJECTS_DIR = DATA_DIR / "projects"
ABOUT_DIR = DATA_DIR / "about"

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change-me")

JWT_SECRET = os.getenv("JWT_SECRET", "insecure-dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 7  # one week

COOKIE_NAME = "zanviq_token"

# Gemini (Google Generative Language API) for KO -> EN translation
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


def ensure_dirs() -> None:
    """Create the data directory tree if it does not yet exist."""
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    ABOUT_DIR.mkdir(parents=True, exist_ok=True)
