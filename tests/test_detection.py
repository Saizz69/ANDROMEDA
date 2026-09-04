import pytest
from subsystem1_ingestion.models import NormalizedPayload
from subsystem2_detection.claim_matcher import claim_matcher
from subsystem2_detection.pattern_tagger import pattern_tagger
from subsystem2_detection.engine import detection_engine
from subsystem2_detection.tavily_search import tavily_search
from subsystem3_response.llm_generator import llm_generator

def test_claim_matcher_known_hoax():
    match = claim_matcher.match_claim("Drinking boiled garlic water cures coronavirus completely")
    assert match is not None
    assert match["verdict"].lower() == "false"
    assert "garlic" in match["claim_text"].lower()

def test_claim_matcher_unknown_claim():
    match = claim_matcher.match_claim("The weather tomorrow in Springfield will be 22 degrees celsius")
    assert match is None

def test_pattern_tagger_detection():
    tags = pattern_tagger.detect_tags("URGENT ALERT: Forward to 10 contacts before midnight or police will block your account!")
    assert "fear_appeal" in tags
    assert "false_urgency" in tags

@pytest.mark.asyncio
async def test_detection_engine_known_hoax():
    payload = NormalizedPayload(
        content_type="text",
        raw_content="Government is giving free laptops to all students click link to register now",
        extracted_text="Government is giving free laptops to all students click link to register now",
        language="en"
    )
    verdict = await detection_engine.analyze(payload)
    assert verdict.verdict.upper() == "FALSE"
    assert verdict.first_seen_date is not None
    assert len(verdict.sources) > 0

@pytest.mark.asyncio
async def test_detection_engine_ambiguous_claim():
    payload = NormalizedPayload(
        content_type="text",
        raw_content="My neighbor claims the local library is closing next month",
        extracted_text="My neighbor claims the local library is closing next month",
        language="en"
    )
    verdict = await detection_engine.analyze(payload)
    assert verdict.verdict.upper() in ["UNVERIFIABLE", "UNVERIFIED", "FALSE", "TRUE", "MISLEADING"]

@pytest.mark.asyncio
async def test_tavily_search_empty_query():
    res = await tavily_search.search_evidence("")
    assert res["has_sufficient_evidence"] is False
    assert len(res["results"]) == 0

@pytest.mark.asyncio
async def test_llm_generator_evaluate_evidence_fallback():
    eval_res = llm_generator._fallback_evidence_evaluation(
        claim="Boiled lemon cures everything",
        evidence_items=[
            {"content": "Medical experts debunked this claim as a false hoax with no evidence."},
            {"content": "Fact-check confirms this is untrue and misleading."}
        ]
    )
    assert eval_res["verdict"] == "FALSE"
