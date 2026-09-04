import pytest
from subsystem1_ingestion.models import NormalizedPayload
from subsystem1_ingestion.ocr_engine import ocr_engine
from subsystem1_ingestion.asr_engine import asr_engine

def test_normalized_payload_creation():
    payload = NormalizedPayload(
        content_type="text",
        raw_content="Garlic cures virus",
        extracted_text="Garlic cures virus",
        language="en"
    )
    assert payload.content_type == "text"
    assert payload.extracted_text == "Garlic cures virus"
    assert payload.language == "en"

def test_ocr_engine_fallback():
    extracted = ocr_engine.extract_text_from_image_bytes(b"invalid_image_bytes")
    assert isinstance(extracted, str)

def test_asr_engine_transcribe():
    text, lang = asr_engine.transcribe_audio_bytes(b"dummy_audio")
    assert isinstance(text, str)
    assert lang == "en"

def test_normalized_payload_with_media():
    payload = NormalizedPayload(
        content_type="image",
        raw_content="photo.png",
        extracted_text="Boiled garlic cure",
        media_base64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        media_filename="photo.png",
        language="en"
    )
    assert payload.content_type == "image"
    assert payload.media_filename == "photo.png"
    assert payload.media_base64 is not None

