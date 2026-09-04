from abc import ABC, abstractmethod
from typing import Any, Dict
from subsystem1_ingestion.models import NormalizedPayload

class BaseInterfaceAdapter(ABC):
    """Abstract Interface Adapter to allow seamless swapping between Telegram, WhatsApp/Twilio, and Web."""

    @abstractmethod
    async def parse_incoming_request(self, raw_request: Any) -> NormalizedPayload:
        """Parse raw platform payload into a NormalizedPayload."""
        pass

    @abstractmethod
    async def send_response(self, recipient_id: str, text_response: str, card_image_bytes: bytes = None) -> bool:
        """Send final plain-language response and visual correction card to recipient."""
        pass
