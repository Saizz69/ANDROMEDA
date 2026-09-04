import json
import logging
import re
import string
from typing import Optional, Dict, Any, List
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from config import settings

logger = logging.getLogger(__name__)

def normalize_text(text: str) -> str:
    """Normalize text by lowercasing and stripping punctuation."""
    if not text:
        return ""
    text = text.lower().strip()
    # Replace punctuation with space
    text = re.sub(f"[{re.escape(string.punctuation)}]", " ", text)
    # Collapse multiple whitespaces
    text = re.sub(r"\s+", " ", text).strip()
    return text

class ClaimMatcher:
    def __init__(self, db_path=None):
        self.db_path = db_path or settings.DATABASE_PATH
        self.hoaxes: List[Dict[str, Any]] = []
        self.vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
        self.tfidf_matrix = None
        self._load_database()

    def _load_database(self):
        """Loads seeded hoaxes database and fits TF-IDF vectorizer."""
        try:
            if self.db_path.exists():
                with open(self.db_path, "r", encoding="utf-8") as f:
                    self.hoaxes = json.load(f)
                
                texts = [normalize_text(h["claim_text"]) for h in self.hoaxes]
                if texts:
                    self.tfidf_matrix = self.vectorizer.fit_transform(texts)
                    logger.info(f"Loaded {len(self.hoaxes)} verified hoaxes into claim matcher.")
            else:
                logger.warning(f"Hoaxes database not found at {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to load claim database: {e}")

    def match_claim(self, input_text: str, threshold: float = 0.28) -> Optional[Dict[str, Any]]:
        """
        Matches input_text against in-memory claim database using normalized TF-IDF cosine similarity.
        Returns matched hoax dictionary or None if unverified.
        """
        if not input_text or not self.hoaxes or self.tfidf_matrix is None:
            return None

        clean_input = normalize_text(input_text)
        if not clean_input:
            return None

        try:
            input_vector = self.vectorizer.transform([clean_input])
            similarities = cosine_similarity(input_vector, self.tfidf_matrix)[0]
            
            best_idx = int(similarities.argmax())
            best_score = float(similarities[best_idx])
            
            # Check for direct keyword/phrase containment boost
            target_claim_clean = normalize_text(self.hoaxes[best_idx]["claim_text"])
            input_words = set(clean_input.split())
            claim_words = set(target_claim_clean.split())
            
            # If significant keyword overlap exists for key nouns
            if len(input_words.intersection(claim_words)) >= 3:
                best_score = max(best_score, 0.40)
            
            logger.info(f"Claim matching best score: {best_score:.4f} for text: '{input_text[:40]}...'")
            
            if best_score >= threshold:
                matched_hoax = self.hoaxes[best_idx].copy()
                matched_hoax["match_score"] = best_score
                return matched_hoax
        except Exception as e:
            logger.error(f"Error in match_claim: {e}")
            
        return None

claim_matcher = ClaimMatcher()

