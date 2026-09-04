import logging
from typing import Dict, Any, Tuple
from subsystem2_detection.models import VerdictPayload
from subsystem3_response.llm_generator import llm_generator
from subsystem3_response.card_renderer import card_renderer

logger = logging.getLogger(__name__)

class ResponseOrchestrator:
    async def generate_full_reply(self, verdict_payload: VerdictPayload, user_language: str = "en") -> Tuple[str, bytes]:
        """
        Takes VerdictPayload, generates plain-language text explanation and visual correction card.
        Returns Tuple[text_response, card_image_bytes].
        """
        # 1. Generate text explanation strictly obeying guardrails
        text_explanation = await llm_generator.generate_response(verdict_payload, user_language=user_language)
        
        # 2. Render visual correction card PNG image
        card_bytes = card_renderer.create_correction_card(verdict_payload)
        
        return text_explanation, card_bytes

response_orchestrator = ResponseOrchestrator()
