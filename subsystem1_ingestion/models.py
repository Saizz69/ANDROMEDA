from datetime import datetime, timezone
from typing import Literal, Optional
from pydantic import BaseModel, Field, ConfigDict

class NormalizedPayload(BaseModel):
    content_type: Literal["image", "text", "voice"]
    raw_content: str = Field(..., description="Base64 data or raw string or file path")
    extracted_text: str = Field(..., description="Text extracted via OCR, voice ASR, or direct user input")
    media_base64: Optional[str] = Field(default=None, description="Optional raw base64 data for image/audio verification")
    media_filename: Optional[str] = Field(default=None, description="Original filename of uploaded media")
    language: str = Field(default="en", description="Detected language ISO code (e.g. en, hi, es)")
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "content_type": "text",
                "raw_content": "Boiled garlic water cures covid",
                "extracted_text": "Boiled garlic water cures covid",
                "language": "en",
                "timestamp": "2026-09-04T12:00:00Z"
            }
        }
    )
