import base64
from fastapi import APIRouter, UploadFile, File, Form
from typing import Optional
from subsystem1_ingestion.models import NormalizedPayload
from subsystem1_ingestion.ocr_engine import ocr_engine
from subsystem1_ingestion.asr_engine import asr_engine

router = APIRouter(prefix="/api/ingest", tags=["Ingestion"])

@router.post("/web", response_model=NormalizedPayload)
async def ingest_web_input(
    text_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """Normalize web companion text or file input into NormalizedPayload."""
    media_b64 = None
    if file:
        file_bytes = await file.read()
        filename = file.filename.lower() if file.filename else "upload"
        media_b64 = base64.b64encode(file_bytes).decode("utf-8")
        
        if any(filename.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp"]):
            extracted = ocr_engine.extract_text_from_image_bytes(file_bytes)
            return NormalizedPayload(
                content_type="image",
                raw_content=file.filename or "uploaded_image",
                extracted_text=extracted if extracted else (text_content or "Uploaded image claim"),
                media_base64=media_b64,
                media_filename=file.filename,
                language="en"
            )
        elif any(filename.endswith(ext) for ext in [".mp3", ".wav", ".ogg", ".m4a"]):
            asr_text, lang = asr_engine.transcribe_audio_bytes(file_bytes, filename=filename)
            return NormalizedPayload(
                content_type="voice",
                raw_content=file.filename or "uploaded_audio",
                extracted_text=asr_text if asr_text else (text_content or "Uploaded voice claim"),
                media_base64=media_b64,
                media_filename=file.filename,
                language=lang
            )

    user_text = text_content.strip() if text_content else "Forwarded claim"
    return NormalizedPayload(
        content_type="text",
        raw_content=user_text,
        extracted_text=user_text,
        language="en"
    )
