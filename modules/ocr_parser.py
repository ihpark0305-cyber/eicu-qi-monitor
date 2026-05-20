import os, base64, json, re
import requests

PROMPT = """이 이미지는 병원 불출증 또는 간호처방집계입니다.
표에서 각 행의 데이터를 추출하여 아래 JSON 형식으로만 응답하세요.
다른 텍스트 없이 JSON 배열만 반환하세요.

[
  {
    "item": "품목명 또는 처방명",
    "code": "처방코드(있으면, 없으면 빈 문자열)",
    "unit": "단위",
    "order_qty": 청구수량 또는 처방수량(숫자 또는 null),
    "delivered_qty": 출고량(숫자 또는 null),
    "return_qty": 반환수량(숫자 또는 null),
    "actual_qty": 실수량(숫자 또는 null),
    "note": "비고",
    "confidence": "high 또는 medium 또는 low"
  }
]

규칙:
- 숫자가 없거나 불명확하면 null, 해당 행의 confidence는 low
- 간호처방집계인 경우: order_qty=처방수량, return_qty=반환수량, actual_qty=실수량
- 불출증인 경우: delivered_qty=출고량, order_qty=발주수량
- 헤더 행, 합계 행, 빈 행은 포함하지 않음
- 품목명(처방명)이 비어 있는 행은 포함하지 않음
- 한국어 텍스트를 정확하게 인식하세요
"""

MIME_MAP = {
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
}

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"


def extract_from_image(file_bytes: bytes, mime_type: str) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY 미설정", "manual_mode": True}

    try:
        b64 = base64.b64encode(file_bytes).decode("utf-8")

        payload = {
            "contents": [{
                "parts": [
                    {"text": PROMPT},
                    {"inline_data": {"mime_type": mime_type, "data": b64}}
                ]
            }]
        }

        res = requests.post(
            GEMINI_URL,
            params={"key": api_key},
            json=payload,
            timeout=30
        )
        result = res.json()

        if "error" in result:
            msg = result["error"].get("message", str(result["error"]))
            return {"error": f"Gemini API 오류: {msg}", "manual_mode": True}

        text = result["candidates"][0]["content"]["parts"][0]["text"].strip()

        match = re.search(r'\[.*\]', text, re.DOTALL)
        if not match:
            return {"error": f"JSON 추출 실패: {text[:200]}", "manual_mode": True}

        items = json.loads(match.group())
        return {"items": items, "count": len(items)}

    except requests.exceptions.Timeout:
        return {"error": "요청 시간 초과 (30초)", "manual_mode": True}
    except json.JSONDecodeError as e:
        return {"error": f"JSON 파싱 오류: {str(e)}", "manual_mode": True}
    except Exception as e:
        return {"error": f"오류: {str(e)}", "manual_mode": True}
