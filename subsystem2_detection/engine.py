import base64
import logging
from typing import Optional
from subsystem1_ingestion.models import NormalizedPayload
from subsystem2_detection.models import VerdictPayload
from subsystem2_detection.claim_matcher import claim_matcher
from subsystem2_detection.pattern_tagger import pattern_tagger
from subsystem2_detection.deepfake_classifier import deepfake_classifier
from subsystem2_detection.tavily_search import tavily_search
from subsystem3_response.llm_generator import llm_generator

logger = logging.getLogger(__name__)

class DetectionEngine:
    async def analyze(self, payload: NormalizedPayload) -> VerdictPayload:
        """
        Orchestrate the fact-checking and retrieval pipeline:
        1. Pattern Tagging
        2. Check Local Curated Hoax Database
        3. Check Deepfake / Image Tampering
        4. Live Web Search & Evidence Gathering via Tavily
        5. Evidence Evaluation via Featherless AI
        6. Return grounded VerdictPayload (TRUE, FALSE, MISLEADING, UNVERIFIABLE)
        """
        text_to_check = payload.extracted_text or payload.raw_content
        manipulation_tags = pattern_tagger.detect_tags(text_to_check)
        
        # 1. Match against curated local hoax database
        matched_hoax = claim_matcher.match_claim(text_to_check)
        
        if matched_hoax:
            logger.info(f"Local hoax database match found for claim: '{matched_hoax.get('claim_text')}'")
            db_tags = matched_hoax.get("persuasion_tactics", [])
            combined_tags = list(set(manipulation_tags + db_tags))
            
            resurfaces = matched_hoax.get("resurfaces_seasonally", False)
            season_note = " This claim resurfaces seasonally." if resurfaces else ""
            
            first_seen = matched_hoax.get("first_seen_date", "Unknown date")
            confidence = f"This message matches a known recurring rumor first observed in {first_seen}.{season_note}"
            
            return VerdictPayload(
                verdict=matched_hoax.get("verdict", "FALSE").upper(),
                matched_claim=matched_hoax.get("claim_text"),
                first_seen_date=first_seen,
                manipulation_tags=combined_tags,
                sources=matched_hoax.get("verified_sources", []),
                confidence_note=confidence,
                evidence_summary="Verified against local curated fact-check database."
            )

        # 2. Check for image manipulation / Deepfake if image content is present
        image_bytes = None
        if payload.content_type == "image":
            if payload.media_base64:
                try:
                    b64 = payload.media_base64
                    if "," in b64:
                        b64 = b64.split(",")[1]
                    image_bytes = base64.b64decode(b64)
                except Exception as e:
                    logger.warning(f"Could not decode media_base64: {e}")
            elif payload.raw_content and len(payload.raw_content) > 100:
                try:
                    image_bytes = base64.b64decode(payload.raw_content)
                except Exception:
                    pass

        if image_bytes:
            deepfake_result = deepfake_classifier.analyze_image_bytes(image_bytes)
            if deepfake_result.get("is_manipulated"):
                manipulation_tags.append("digital_image_manipulation")
                return VerdictPayload(
                    verdict="FALSE",
                    matched_claim=None,
                    first_seen_date=None,
                    manipulation_tags=list(set(manipulation_tags)),
                    sources=[],
                    confidence_note="Visual analysis shows digital modifications or facial tampering in this image.",
                    evidence_summary="Image analysis detected synthetic noise or manipulation artifacts."
                )

        # 3. Live Web Search & Evidence Retrieval via Tavily
        logger.info(f"Querying Tavily Search for live web evidence: '{text_to_check[:60]}...'")
        tavily_data = await tavily_search.search_evidence(text_to_check, max_results=5)

        if tavily_data.get("has_sufficient_evidence") and tavily_data.get("results"):
            evidence_results = tavily_data["results"]
            sources = tavily_data.get("sources", [])

            # 4. Evaluate Retrieved Evidence using Featherless AI
            logger.info("Evaluating Tavily evidence using Featherless AI...")
            eval_result = await llm_generator.evaluate_evidence(
                claim=text_to_check,
                evidence_items=evidence_results,
                user_language=payload.language
            )

            verdict = eval_result.get("verdict", "UNVERIFIABLE").upper()
            confidence_note = eval_result.get("confidence_note", "Evidence analyzed from multiple web sources.")
            evidence_summary = eval_result.get("evidence_summary", "")

            return VerdictPayload(
                verdict=verdict,
                matched_claim=None,
                first_seen_date=None,
                manipulation_tags=list(set(manipulation_tags)),
                sources=sources[:3],
                confidence_note=confidence_note,
                evidence_summary=evidence_summary
            )

        # 5. Insufficient verified evidence / Tavily failure fallback
        logger.info("Insufficient evidence retrieved from Tavily web search. Returning UNVERIFIABLE.")
        return VerdictPayload(
            verdict="UNVERIFIABLE",
            matched_claim=None,
            first_seen_date=None,
            manipulation_tags=list(set(manipulation_tags)),
            sources=[],
            confidence_note="Insufficient verified evidence found online to confirm or debunk this claim.",
            evidence_summary="No conclusive reports found across web fact-checkers."
        )

detection_engine = DetectionEngine()
