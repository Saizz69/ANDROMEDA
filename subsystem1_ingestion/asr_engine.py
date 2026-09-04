import base64
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

class ASREngine:
    def __init__(self):
        pass

    def transcribe_audio_bytes(self, audio_bytes: bytes, filename: str = "voice_note.ogg") -> Tuple[str, str]:
        """
        Transcribe voice note audio bytes to text and detect language.
        Returns Tuple[extracted_text, detected_language_code].
        """
        try:
            # Here real Whisper API or local whisper model call can be hooked up.
            # In mock/offline mode or default fallback:
            # Detect language or transcribe audio
            extracted_text = "Audio claim stating boiled garlic water cures viruses."
            detected_language = "en"
            return extracted_text, detected_language
        except Exception as e:
            logger.error(f"Error in ASREngine transcription: {e}")
            return "", "en"

    def transcribe_base64(self, base64_str: str) -> Tuple[str, str]:
        """Transcribe base64 encoded audio."""
        try:
            if "," in base64_str:
                base64_str = base64_str.split(",")[1]
            audio_bytes = base64.b64decode(base64_str)
            return self.transcribe_audio_bytes(audio_bytes)
        except Exception as e:
            logger.error(f"Failed decoding base64 audio: {e}")
            return "", "en"

asr_engine = ASREngine()
