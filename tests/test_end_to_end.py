import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_homepage_serves_html():
    response = client.get("/")
    assert response.status_code == 200
    assert "Family Misinformation Decoder" in response.text

def test_check_payload_known_hoax():
    payload_data = {
        "content_type": "text",
        "raw_content": "UNESCO named Indian national anthem best in the world",
        "extracted_text": "UNESCO named Indian national anthem best in the world",
        "language": "en",
        "timestamp": "2026-09-04T12:00:00Z"
    }
    response = client.post("/api/check-payload", json=payload_data)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["verdict"]["verdict"].upper() == "FALSE"
    assert "text_explanation" in res_json
    assert res_json["card_image_base64"] is not None

def test_check_payload_ambiguous_claim():
    payload_data = {
        "content_type": "text",
        "raw_content": "Random unverified local news statement",
        "extracted_text": "Random unverified local news statement",
        "language": "en",
        "timestamp": "2026-09-04T12:00:00Z"
    }
    response = client.post("/api/check-payload", json=payload_data)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["verdict"]["verdict"].upper() in ["UNVERIFIABLE", "UNVERIFIED", "FALSE", "TRUE", "MISLEADING"]
    assert "couldn't verify" in res_json["text_explanation"].lower() or "unverified" in res_json["text_explanation"].lower() or "evidence" in res_json["text_explanation"].lower()

