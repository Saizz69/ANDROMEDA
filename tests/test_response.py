import pytest
from subsystem2_detection.models import VerdictPayload
from subsystem3_response.llm_generator import llm_generator
from subsystem3_response.card_renderer import card_renderer

@pytest.mark.asyncio
async def test_llm_generator_zero_hallucination_guardrail():
    payload = VerdictPayload(
        verdict="false",
        matched_claim="Boiled garlic water cures coronavirus",
        first_seen_date="2020-02-10",
        manipulation_tags=["false_authority", "fear_appeal"],
        sources=["https://www.who.int/mythbusters"],
        confidence_note="This claim has been circulating since early 2020."
    )
    
    response_text = await llm_generator.generate_response(payload, user_language="en")
    
    assert "2020-02-10" in response_text
    assert "Simple next step" in response_text
    # Ensure tone is warm and friendly, non-judgmental
    assert "62%" not in response_text
    assert "confidence score" not in response_text.lower()

def test_card_renderer_png_generation():
    payload = VerdictPayload(
        verdict="false",
        matched_claim="WhatsApp will become paid ₹0.99 starting tomorrow",
        first_seen_date="2012-03-01",
        manipulation_tags=["false_urgency"],
        sources=["https://faq.whatsapp.com/"],
        confidence_note="Known chain message rumor."
    )
    
    card_bytes = card_renderer.create_correction_card(payload)
    assert isinstance(card_bytes, bytes)
    assert len(card_bytes) > 1000
    assert card_bytes[:4] == b"\x89PNG"
