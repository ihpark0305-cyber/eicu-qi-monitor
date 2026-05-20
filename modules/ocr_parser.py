import os, base64, json, re
import google.generativeai as genai

PROMPT = """이 이미지는 병원 불출증 또는 간호처방집계입니다.
표에서 각 행의 데이터를 추출하여 아래 JSON 형식으로만 응답하세요.
다른 텍스트 없이 JSON 배열만 반환하세요.

[
  {
    "item": "품목명 또는 처방명",
    "code": "처방코드(있으면)",
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


def extract_from_image(file_bytes: bytes, mime_type: str) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY 미설정", "manual_mode": True}

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        image_part = {
            "inline_data": {
                "mime_type": mime_type,
                "data": base64.b64encode(file_bytes).decode("utf-8"),
            }
        }

        response = model.generate_content([PROMPT, image_part])
        raw = response.text.strip()

        # JSON 배열 추출
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if not match:
            return {"error": "JSON 배열 추출 실패 — 수동 입력 모드를 사용하세요", "manual_mode": True}

        items = json.loads(match.group())
        return {"items": items, "count": len(items)}

    except json.JSONDecodeError:
        return {"error": "JSON 파싱 실패 — 수동 입력 모드를 사용하세요", "manual_mode": True}
    except Exception as e:
        return {"error": str(e), "manual_mode": True}
