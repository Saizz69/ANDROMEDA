import json
import logging
import re
import httpx
from typing import Dict, Any, List, Optional
from config import settings
from subsystem2_detection.models import VerdictPayload

logger = logging.getLogger(__name__)

# Persuasion technique explanations in simple, non-judgmental language
TACTIC_EXPLANATIONS = {
    "fear_appeal": "This message uses scary language to make you feel worried before you have time to check if it is true.",
    "false_urgency": "This message asks you to forward it quickly before it gets deleted, which is a common trick to rush people into sharing.",
    "false_authority": "This message mentions big names or titles to sound official, but no official statement was actually made.",
    "fake_social_proof": "This message claims thousands of people have tried it, to make it sound believable without showing real proof.",
    "digital_image_manipulation": "This photo appears to have been edited or altered digitally."
}

SYSTEM_PROMPT = """You are a warm, patient, and respectful assistant helping older relatives check messages they received on family groups.
Your tone must be calm, caring, and non-judgmental—like a loving family member explaining something clearly.

STRICT GUARDRAILS:
1. You MUST ONLY state facts, dates, and sources provided directly in the VERDICT DATA below.
2. DO NOT invent, hallucinate, or add any outside numbers, dates, medical facts, or statistics.
3. If the verdict is 'UNVERIFIABLE' or 'unverified', say clearly that you cannot confirm it right now, and give ONE simple next step to check safely.
4. If the verdict is 'MISLEADING', explain gently which part is misleading and what context is missing.
5. Always name and explain any persuasion techniques present in simple terms.
6. End every message with ONE simple, doable, practical next step.
"""

EVALUATOR_SYSTEM_PROMPT = """You are a factual misinformation investigator evaluating a claim against retrieved web search evidence.

STRICT EVALUATION RULES:
1. Base your decision ONLY on the provided retrieved web sources. Do not make up facts or assumptions.
2. Output a valid JSON object strictly matching this schema:
   {
     "verdict": "TRUE" | "FALSE" | "MISLEADING" | "UNVERIFIABLE",
     "confidence_note": "A concise 1-2 sentence plain-language statement explaining the finding.",
     "evidence_summary": "1-2 sentences summarizing key facts from the sources."
   }
3. Guidelines for Verdicts:
   - "FALSE": Reliable evidence directly refutes the claim or confirms it as a known hoax/fake news.
   - "TRUE": Reliable evidence confirms all core assertions of the claim as accurate.
   - "MISLEADING": The claim contains a grain of truth but distorts context, exaggerates, or misrepresents facts.
   - "UNVERIFIABLE": The evidence is insufficient, contradictory, or from unverified rumor mills.
"""

class LLMResponseGenerator:
    def __init__(self):
        self.api_key = settings.FEATHERLESS_API_KEY
        self.base_url = settings.LLM_BASE_URL
        self.model = settings.LLM_MODEL

    async def evaluate_evidence(self, claim: str, evidence_items: List[Dict[str, Any]], user_language: str = "en") -> Dict[str, Any]:
        """
        Calls Featherless AI to evaluate a claim against Tavily retrieved web evidence.
        Returns a dict with verdict ('TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIABLE'), confidence_note, and evidence_summary.
        """
        if not evidence_items:
            return {
                "verdict": "UNVERIFIABLE",
                "confidence_note": "Insufficient verified evidence found online to confirm or debunk this claim.",
                "evidence_summary": "No conclusive web reports found."
            }

        # Format evidence snippets cleanly for the LLM
        evidence_text = "\n\n".join([
            f"Source [{i+1}] ({item.get('url', '')}):\nTitle: {item.get('title', '')}\nContent: {item.get('content', '')}"
            for i, item in enumerate(evidence_items[:5])
        ])

        user_content = f"CLAIM TO VERIFY:\n\"{claim}\"\n\nRETRIEVED WEB EVIDENCE:\n{evidence_text}"

        if self.api_key != "YOUR_LLM_API_KEY_PLACEHOLDER" and not settings.USE_MOCK_SERVICES:
            try:
                async with httpx.AsyncClient(timeout=18.0) as client:
                    response = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": self.model,
                            "messages": [
                                {"role": "system", "content": EVALUATOR_SYSTEM_PROMPT},
                                {"role": "user", "content": user_content}
                            ],
                            "max_tokens": 180,
                            "temperature": 0.1
                        }
                    )

                    if response.status_code == 200:
                        data = response.json()
                        raw_output = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

                        # Extract JSON from model output
                        json_match = re.search(r"\{.*\}", raw_output, re.DOTALL)
                        if json_match:
                            parsed = json.loads(json_match.group(0))
                            verdict = parsed.get("verdict", "UNVERIFIABLE").upper()
                            if verdict not in ["TRUE", "FALSE", "MISLEADING", "UNVERIFIABLE"]:
                                verdict = "UNVERIFIABLE"

                            return {
                                "verdict": verdict,
                                "confidence_note": parsed.get("confidence_note", "Evidence analyzed from multiple web sources."),
                                "evidence_summary": parsed.get("evidence_summary", "")
                            }
                    else:
                        logger.warning(f"Featherless evaluation API returned status {response.status_code}: {response.text[:200]}")

            except Exception as e:
                logger.error(f"Featherless evaluation failed: {e}. Using fallback evaluator.")

        # Heuristic fallback evaluator for offline/mock mode
        return self._fallback_evidence_evaluation(claim, evidence_items)

    def _fallback_evidence_evaluation(self, claim: str, evidence_items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Deterministic evaluation fallback based on keyword corroboration."""
        combined_text = " ".join([e.get("content", "").lower() for e in evidence_items])
        
        debunk_keywords = ["false", "hoax", "debunked", "fake", "rumor", "untrue", "misleading", "fact-check", "no evidence"]
        verify_keywords = ["confirmed", "official announcement", "true", "verified", "statement by"]

        debunk_hits = sum(1 for kw in debunk_keywords if kw in combined_text)
        verify_hits = sum(1 for kw in verify_keywords if kw in combined_text)

        if debunk_hits > verify_hits and debunk_hits >= 2:
            return {
                "verdict": "FALSE",
                "confidence_note": "Fact-checking sources and news reports indicate this claim is untrue or fabricated.",
                "evidence_summary": "Independent fact checks and official statements dispute this claim."
            }
        elif verify_hits > debunk_hits and verify_hits >= 2:
            return {
                "verdict": "TRUE",
                "confidence_note": "Official and reputable reports corroborate this information.",
                "evidence_summary": "Multiple news reports confirm this statement."
            }
        elif debunk_hits > 0 and verify_hits > 0:
            return {
                "verdict": "MISLEADING",
                "confidence_note": "This message mixes real events with inaccurate or unverified details.",
                "evidence_summary": "Reports suggest context was altered or exaggerated."
            }
        else:
            return {
                "verdict": "UNVERIFIABLE",
                "confidence_note": "Insufficient reliable evidence found online to confirm or debunk this claim.",
                "evidence_summary": "No verified consensus in available sources."
            }

    async def generate_response(self, verdict_payload: VerdictPayload, user_language: str = "en") -> str:
        """
        Generate warm, plain-language text explanation matching verdict payload.
        Fast deterministic generation ensures zero hallucinations and instant responses.
        """
        if verdict_payload.custom_explanation:
            return verdict_payload.custom_explanation
        return self._generate_template_response(verdict_payload, user_language)

    def _generate_template_response(self, payload: VerdictPayload, lang: str) -> str:
        """Deterministically generates warm, factual response without hallucinations."""
        parts = []
        verdict = payload.verdict.upper()

        if verdict == "FALSE":
            parts.append("💛 **Please take a moment before forwarding this.**")
            parts.append("This message contains information that has been checked and found to be untrue.")
            
            if payload.matched_claim:
                parts.append(f"\n**Original Claim:** \"{payload.matched_claim}\"")
                
            if payload.first_seen_date:
                parts.append(f"This specific rumor has been circulating since **{payload.first_seen_date}**.")
                
        elif verdict == "MISLEADING":
            parts.append("🔶 **Caution: This message is misleading.**")
            parts.append("While part of this message may be based on real events, important context has been distorted, exaggerated, or left out.")

        elif verdict in ["UNVERIFIABLE", "UNVERIFIED"]:
            parts.append("🧡 **We couldn't verify this message yet.**")
            parts.append("There is insufficient verified information available right now to confirm if this is true or false.")

        else: # TRUE
            parts.append("💚 **This information appears to be verified.**")
            parts.append("Reputable records and reports corroborate the details in this message.")

        # Explain persuasion tactics if any
        if payload.manipulation_tags:
            parts.append("\n**Notice how this message is written:**")
            for tag in payload.manipulation_tags:
                explanation = TACTIC_EXPLANATIONS.get(tag, f"It uses persuasive tactics ({tag}).")
                parts.append(f"• {explanation}")

        # Sources if present
        if payload.sources:
            parts.append("\n**Verified Sources & Evidence:**")
            for src in payload.sources[:3]:
                parts.append(f"• {src}")

        # Plain language confidence note
        if payload.confidence_note:
            parts.append(f"\n_{payload.confidence_note}_")

        # Actionable next step
        parts.append("\n**Simple next step:**")
        if verdict == "FALSE":
            parts.append("Instead of forwarding this message, share the correction card below with your family group so everyone stays informed! 🌸")
        elif verdict == "MISLEADING":
            parts.append("Please hold off on sharing until full context from official sources is confirmed. 🌸")
        elif verdict in ["UNVERIFIABLE", "UNVERIFIED"]:
            parts.append("Wait before forwarding. You can check official government news portals or consult your local doctor before acting on health advice. 🌸")
        else:
            parts.append("Feel free to read the official sources above before sharing with family. 🌸")

        return "\n".join(parts)

llm_generator = LLMResponseGenerator()
