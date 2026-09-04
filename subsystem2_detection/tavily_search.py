import logging
import httpx
from typing import Dict, Any, List
from config import settings

logger = logging.getLogger(__name__)

class TavilySearchService:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.TAVILY_API_KEY
        self.endpoint = "https://api.tavily.com/search"

    async def search_evidence(self, query: str, max_results: int = 5) -> Dict[str, Any]:
        """
        Searches the web for evidence on a given claim using Tavily Search API.
        Returns extracted source snippets, URLs, and evidence quality indicator.
        """
        if not query or not query.strip():
            return {"results": [], "has_sufficient_evidence": False, "answer": None, "sources": []}

        # Check for mock / offline mode
        if self.api_key == "YOUR_TAVILY_API_KEY_PLACEHOLDER" or settings.USE_MOCK_SERVICES:
            logger.info("Using Tavily Search offline mock adapter.")
            return self._mock_search(query)

        try:
            payload = {
                "api_key": self.api_key,
                "query": query,
                "search_depth": "basic",
                "include_answer": False,
                "max_results": min(max_results, 3)
            }

            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(self.endpoint, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    raw_results = data.get("results", [])
                    answer = data.get("answer")

                    processed_results = []
                    sources = []
                    for item in raw_results:
                        url = item.get("url", "")
                        title = item.get("title", "")
                        content = item.get("content", "")
                        score = item.get("score", 0.0)

                        if url and url not in sources:
                            sources.append(url)

                        processed_results.append({
                            "title": title,
                            "url": url,
                            "content": content,
                            "score": score
                        })

                    has_sufficient_evidence = len(processed_results) > 0 and any(len(r["content"]) > 30 for r in processed_results)

                    return {
                        "query": query,
                        "results": processed_results,
                        "sources": sources[:4],
                        "answer": answer,
                        "has_sufficient_evidence": has_sufficient_evidence
                    }
                else:
                    logger.warning(f"Tavily Search API returned status {response.status_code}: {response.text[:200]}")
                    return {"results": [], "has_sufficient_evidence": False, "answer": None, "sources": []}

        except Exception as e:
            logger.error(f"Tavily Search request failed: {e}")
            return {"results": [], "has_sufficient_evidence": False, "answer": None, "sources": []}

    def _mock_search(self, query: str) -> Dict[str, Any]:
        """Provides simulated search evidence for offline testing."""
        return {
            "query": query,
            "results": [
                {
                    "title": "Fact Check Analysis",
                    "url": "https://www.factcheck.org/evidence",
                    "content": f"Independent research and official reports regarding: {query}",
                    "score": 0.85
                }
            ],
            "sources": ["https://www.factcheck.org/evidence"],
            "answer": "There is no conclusive official verification for this claim.",
            "has_sufficient_evidence": True
        }

tavily_search = TavilySearchService()
