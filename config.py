import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file if available
BASE_DIR = Path(__file__).resolve().parent
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

class Settings:
    PROJECT_NAME: str = "Family Misinformation Decoder"
    VERSION: str = "1.0.0"
    
    # Credentials & API Keys
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "YOUR_TAVILY_API_KEY_PLACEHOLDER")
    FEATHERLESS_API_KEY: str = os.getenv("FEATHERLESS_API_KEY") or os.getenv("LLM_API_KEY", "YOUR_LLM_API_KEY_PLACEHOLDER")
    LLM_API_KEY: str = FEATHERLESS_API_KEY
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://api.featherless.ai/v1")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "aaditya/Llama3-OpenBioLLM-70B")
    
    # Service Settings
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Toggles & Paths
    USE_MOCK_SERVICES: bool = os.getenv("USE_MOCK_SERVICES", "true").lower() in ("true", "1", "yes")
    DATABASE_PATH: Path = BASE_DIR / "database" / "hoaxes.json"
    
settings = Settings()
