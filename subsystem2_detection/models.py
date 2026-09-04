from typing import Literal, Optional, List
from pydantic import BaseModel, Field, ConfigDict

class VerdictPayload(BaseModel):
    verdict: Literal["false", "unverified", "true", "misleading", "unverifiable", "FALSE", "UNVERIFIED", "TRUE", "MISLEADING", "UNVERIFIABLE"] = Field(..., description="Single factual verdict: TRUE, FALSE, MISLEADING, or UNVERIFIABLE")
    matched_claim: Optional[str] = Field(None, description="Exact claim text from DB if matched")
    first_seen_date: Optional[str] = Field(None, description="Date claim was first seen circulating")
    manipulation_tags: List[str] = Field(default_factory=list, description="Persuasion techniques used in message")
    sources: List[str] = Field(default_factory=list, description="Verified source URLs confirming facts")
    confidence_note: str = Field(..., description="Plain-language explanation note, strictly NO numbers or percentages")
    evidence_summary: Optional[str] = Field(None, description="Summary of evidence gathered from Tavily or DB")
    custom_explanation: Optional[str] = Field(None, description="Pre-computed warm plain-language explanation")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "verdict": "false",
                "matched_claim": "Drinking boiled garlic water cures coronavirus",
                "first_seen_date": "2020-02-10",
                "manipulation_tags": ["false_authority", "fear_appeal"],
                "sources": [
                    "https://www.who.int/emergencies/diseases/novel-coronavirus-2019/advice-for-public/myth-busters"
                ],
                "confidence_note": "This claim has been circulating since early 2020 and has been thoroughly debunked by medical authorities."
            }
        }
    )
