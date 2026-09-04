import re
import logging
from typing import List

logger = logging.getLogger(__name__)

# Persuasion Pattern Definitions
FEAR_PATTERNS = [
    r"urgent", r"warning", r"alert", r"danger", r"death", r"die", r"virus", r"cancer",
    r"kidnap", r"blocked", r"police", r"curfew", r"evacuate", r"emergency", r"hazard"
]

URGENCY_PATTERNS = [
    r"share before", r"forward to", r"deleted", r"midnight", r"today only", r"immediately",
    r"don't wait", r"right now", r"before it's taken down", r"hurry", r"pass this on"
]

AUTHORITY_PATTERNS = [
    r"doctor", r"nasa", r"unesco", r"government", r"rbi", r"who", r"ministry",
    r"scientist", r"official notice", r"expert", r"hospital", r"supreme court"
]

SOCIAL_PROOF_PATTERNS = [
    r"\d+\s*people", r"\d+\s*contacts", r"everyone is", r"confirmed by thousands",
    r"proved by", r"widely shared", r"millions of"
]

class PatternTagger:
    def detect_tags(self, text: str) -> List[str]:
        """Detect persuasion technique tags from text content."""
        if not text:
            return []

        text_lower = text.lower()
        tags = []

        # Check Fear Appeal
        if any(re.search(p, text_lower) for p in FEAR_PATTERNS):
            tags.append("fear_appeal")

        # Check False Urgency
        if any(re.search(p, text_lower) for p in URGENCY_PATTERNS):
            tags.append("false_urgency")

        # Check False Authority
        if any(re.search(p, text_lower) for p in AUTHORITY_PATTERNS):
            tags.append("false_authority")

        # Check Fake Social Proof
        if any(re.search(p, text_lower) for p in SOCIAL_PROOF_PATTERNS):
            tags.append("fake_social_proof")

        return tags

pattern_tagger = PatternTagger()
