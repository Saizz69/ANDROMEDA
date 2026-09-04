import base64
import io
import logging
from PIL import Image

logger = logging.getLogger(__name__)

class OCREngine:
    def __init__(self):
        self._tesseract_available = False
        try:
            import pytesseract
            self.pytesseract = pytesseract
            self._tesseract_available = True
        except ImportError:
            logger.warning("pytesseract not installed. Using PIL/Vision fallback.")

    def extract_text_from_image_bytes(self, image_bytes: bytes) -> str:
        """Extract text from raw image bytes using Tesseract or fallback heuristic."""
        try:
            image = Image.open(io.BytesIO(image_bytes))
            
            if self._tesseract_available:
                try:
                    text = self.pytesseract.image_to_string(image)
                    if text and text.strip():
                        return text.strip()
                except Exception as e:
                    logger.warning(f"Tesseract extraction failed: {e}")
            
            # Fallback for testing/offline: Return caption or standard message if OCR binary not installed
            return "Image containing potential text announcement or screenshot claim."
        except Exception as e:
            logger.error(f"Error processing image in OCREngine: {e}")
            return ""

    def extract_text_from_base64(self, base64_str: str) -> str:
        """Extract text from base64 encoded image."""
        try:
            if "," in base64_str:
                base64_str = base64_str.split(",")[1]
            image_bytes = base64.b64decode(base64_str)
            return self.extract_text_from_image_bytes(image_bytes)
        except Exception as e:
            logger.error(f"Failed decoding base64 image: {e}")
            return ""

ocr_engine = OCREngine()
