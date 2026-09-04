import logging
import httpx
from typing import Dict, Any, List, Optional
from config import settings

logger = logging.getLogger(__name__)

class GoogleSearchService:
    def __init__(self, api_key: Optional[str] = None, cse_id: Optional[str] = None):
        self.api_key = api_key or settings.GOOGLE_API_KEY
        self.cse_id = cse_id or settings.GOOGLE_CSE_ID
        self.custom_search_endpoint = "https://www.googleapis.com/customsearch/v1"
        self.fact_check_endpoint = "https://factchecktools.googleapis.com/v1alpha1/claims:search"

    async def search_evidence(self, query: str, max_results: int = 5) -> Dict[str, Any]:
        """
        Searches Google for general info and fact-check records using Google Custom Search
        or Google Fact Check Tools ClaimSearch API.
        """
        if not query or not query.strip():
            return {"results": [], "has_sufficient_evidence": False, "sources": [], "engine": "Google"}

        # If mock mode or no Google key provided
        if not self.api_key or self.api_key == "YOUR_GOOGLE_API_KEY_PLACEHOLDER" or settings.USE_MOCK_SERVICES:
            logger.info("Google API key not configured or mock mode enabled. Using mock Google search.")
            return self._mock_search(query)

        # 1. If Google Custom Search Engine ID (cx) is configured, perform general Google web search
        if self.cse_id and self.cse_id != "YOUR_GOOGLE_CSE_ID_PLACEHOLDER":
            cse_result = await self._search_custom_search(query, max_results)
            if cse_result.get("has_sufficient_evidence"):
                return cse_result

        # 2. Query Google Fact Check Tools API (works with Google API Key directly)
        fact_check_result = await self._search_fact_check_tools(query)
        if fact_check_result.get("has_sufficient_evidence"):
            return fact_check_result

        # 3. If CSE ID is present, try fallback custom search
        if self.cse_id:
            return await self._search_custom_search(query, max_results)

        return {"results": [], "has_sufficient_evidence": False, "sources": [], "engine": "Google Search"}

    async def _search_custom_search(self, query: str, max_results: int = 5) -> Dict[str, Any]:
        """Queries Google Custom Search JSON API for general web results."""
        try:
            params = {
                "key": self.api_key,
                "cx": self.cse_id,
                "q": query,
                "num": min(max_results, 5)
            }
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(self.custom_search_endpoint, params=params)
                if response.status_code == 200:
                    data = response.json()
                    items = data.get("items", [])
                    processed = []
                    sources = []

                    for item in items:
                        title = item.get("title", "")
                        snippet = item.get("snippet", "")
                        link = item.get("link", "")
                        if link and link not in sources:
                            sources.append(link)

                        processed.append({
                            "title": title,
                            "url": link,
                            "content": snippet,
                            "score": 0.9
                        })

                    return {
                        "query": query,
                        "results": processed,
                        "sources": sources[:4],
                        "has_sufficient_evidence": len(processed) > 0,
                        "engine": "Google Custom Search"
                    }
                else:
                    logger.warning(f"Google Custom Search API returned status {response.status_code}: {response.text[:200]}")
        except Exception as e:
            logger.error(f"Google Custom Search failed: {e}")

        return {"results": [], "has_sufficient_evidence": False, "sources": [], "engine": "Google Custom Search"}

    async def _search_fact_check_tools(self, query: str) -> Dict[str, Any]:
        """Queries Google Fact Check Tools ClaimSearch API."""
        try:
            params = {
                "key": self.api_key,
                "query": query,
                "languageCode": "en"
            }
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.get(self.fact_check_endpoint, params=params)
                if response.status_code == 200:
                    data = response.json()
                    claims = data.get("claims", [])
                    processed = []
                    sources = []

                    for c in claims:
                        claim_text = c.get("text", "")
                        claim_reviews = c.get("claimReview", [])
                        for review in claim_reviews:
                            publisher = review.get("publisher", {}).get("name", "Fact Checker")
                            rating = review.get("textualRating", "")
                            url = review.get("url", "")
                            title = review.get("title") or f"{publisher} Fact Check: {rating}"
                            snippet = f"Claim: {claim_text}. Rating by {publisher}: {rating}."

                            if url and url not in sources:
                                sources.append(url)

                            processed.append({
                                "title": title,
                                "url": url,
                                "content": snippet,
                                "score": 0.95
                            })

                    return {
                        "query": query,
                        "results": processed,
                        "sources": sources[:4],
                        "has_sufficient_evidence": len(processed) > 0,
                        "engine": "Google Fact Check Tools API"
                    }
                else:
                    logger.warning(f"Google Fact Check Tools API status {response.status_code}: {response.text[:200]}")
        except Exception as e:
            logger.error(f"Google Fact Check search failed: {e}")

        return {"results": [], "has_sufficient_evidence": False, "sources": [], "engine": "Google Fact Check Tools API"}

    def _mock_search(self, query: str) -> Dict[str, Any]:
        """Provides simulated search evidence for offline testing."""
        return {
            "query": query,
            "results": [
                {
                    "title": "Google Search Overview & Reports",
                    "url": f"https://www.google.com/search?q={query.replace(' ', '+')}",
                    "content": f"Verified public information and accredited references regarding: {query}",
                    "score": 0.88
                }
            ],
            "sources": [f"https://www.google.com/search?q={query.replace(' ', '+')}"],
            "has_sufficient_evidence": True,
            "engine": "Google Search (Simulated)"
        }

google_search = GoogleSearchService()
