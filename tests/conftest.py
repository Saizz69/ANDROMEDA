import pytest
from config import settings

@pytest.fixture(autouse=True)
def configure_test_environment(monkeypatch):
    """Ensure fast, deterministic mock services during automated test suite runs."""
    monkeypatch.setattr(settings, "USE_MOCK_SERVICES", True)
