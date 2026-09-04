import base64
import logging
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Request, Form, File, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from subsystem1_ingestion.models import NormalizedPayload
from subsystem1_ingestion.web_companion import router as ingestion_router
from subsystem1_ingestion.ocr_engine import ocr_engine
from subsystem2_detection.deepfake_classifier import router as deepfake_router
from subsystem2_detection.engine import detection_engine
from subsystem2_detection.claim_matcher import claim_matcher
from subsystem3_response.responder import response_orchestrator

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("main")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Misinformation-checking assistant for first-time internet users and older relatives."
)

# Enable CORS for browser extensions and cross-origin Web Companion requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent

# Mount static asset directories
app.mount("/static", StaticFiles(directory=BASE_DIR / "web" / "static"), name="static")
app.mount("/test-assets", StaticFiles(directory=BASE_DIR / "test"), name="test-assets")
app.mount("/icons", StaticFiles(directory=BASE_DIR / "icons"), name="icons")

templates = Jinja2Templates(directory=BASE_DIR / "web" / "templates")

# Register Subsystem Routers
app.include_router(ingestion_router)
app.include_router(deepfake_router)

@app.get("/", response_class=HTMLResponse)
async def serve_companion_ui(request: Request):
    """Render companion web page."""
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/demo", response_class=HTMLResponse)
async def serve_demo_ui():
    """Serve the interactive feed demo test suite."""
    demo_path = BASE_DIR / "test" / "demo.html"
    if demo_path.exists():
        with open(demo_path, "r", encoding="utf-8") as f:
            content = f.read()
        # Adjust relative stylesheet/script references if needed
        content = content.replace('href="demo.css"', 'href="/test-assets/demo.css"')
        content = content.replace('src="demo.js"', 'src="/test-assets/demo.js"')
        return HTMLResponse(content=content)
    return HTMLResponse(content="<h1>Demo file not found</h1>", status_code=404)

@app.get("/api/status")
async def get_system_status():
    """System health check and connected subsystems inspection."""
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "llm_model": settings.LLM_MODEL,
        "mock_services": settings.USE_MOCK_SERVICES,
        "database_entries": len(claim_matcher.hoaxes) if hasattr(claim_matcher, "hoaxes") else 0,
        "subsystems": {
            "subsystem1_ingestion": "active (Text, OCR, ASR)",
            "subsystem2_detection": "active (Curated DB, Tavily, Featherless AI, Forensic Tampering)",
            "subsystem3_response": "active (Grounded LLM, Pillow Card Renderer)"
        }
    }

@app.post("/api/check-payload")
async def check_normalized_payload(payload: NormalizedPayload):
    """
    End-to-End API processing a NormalizedPayload through Detection Engine & Response Generator.
    """
    # 1. Subsystem 2 - Detection Engine
    verdict = await detection_engine.analyze(payload)
    
    # 2. Subsystem 3 - Response Generator
    text_explanation, card_bytes = await response_orchestrator.generate_full_reply(
        verdict, user_language=payload.language
    )
    
    card_b64 = base64.b64encode(card_bytes).decode("utf-8") if card_bytes else None
    
    return {
        "payload": payload.model_dump(),
        "verdict": verdict.model_dump(),
        "text_explanation": text_explanation,
        "card_image_base64": card_b64
    }

from subsystem1_ingestion.asr_engine import asr_engine

@app.post("/api/check-web")
async def check_web_input(
    text_content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """
    Web Companion endpoint receiving raw form submission and returning complete explanation & card.
    """
    extracted = text_content or ""
    content_type = "text"
    raw_content = text_content or ""
    media_b64 = None
    media_filename = None
    detected_lang = "en"

    if file:
        file_bytes = await file.read()
        filename = file.filename.lower() if file.filename else "upload"
        media_filename = file.filename
        media_b64 = base64.b64encode(file_bytes).decode("utf-8")
        raw_content = filename
        
        if any(filename.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp"]):
            content_type = "image"
            ocr_text = ocr_engine.extract_text_from_image_bytes(file_bytes)
            if ocr_text:
                extracted = f"{extracted} {ocr_text}".strip()
        elif any(filename.endswith(ext) for ext in [".mp3", ".wav", ".ogg", ".m4a"]):
            content_type = "voice"
            asr_text, detected_lang = asr_engine.transcribe_audio_bytes(file_bytes, filename=filename)
            if asr_text:
                extracted = f"{extracted} {asr_text}".strip()

    payload = NormalizedPayload(
        content_type=content_type,
        raw_content=raw_content if raw_content else "Forwarded claim",
        extracted_text=extracted if extracted else "Forwarded claim",
        media_base64=media_b64,
        media_filename=media_filename,
        language=detected_lang
    )

    return await check_normalized_payload(payload)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
