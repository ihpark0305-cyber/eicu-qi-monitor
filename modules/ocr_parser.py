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

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


def extract_from_image(file_bytes: bytes, mime_type: str) -> dict:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"error": "GROQ_API_KEY 미설정", "manual_mode": True}

    try:
        b64 = base64.b64encode(file_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64}"

        payload = {
            "model": GROQ_MODEL,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}}
                ]
            }],
            "max_tokens": 4096,
            "temperature": 0
        }

        res = requests.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=60
        )
        result = res.json()

        if "error" in result:
            msg = result["error"].get("message", str(result["error"]))
            return {"error": f"Groq API 오류: {msg}", "manual_mode": True}

        text = result["choices"][0]["message"]["content"].strip()

        match = re.search(r'\[.*\]', text, re.DOTALL)
        if not match:
            return {"error": f"JSON 추출 실패: {text[:200]}", "manual_mode": True}

        items = json.loads(match.group())
        return {"items": items, "count": len(items)}

    except requests.exceptions.Timeout:
        return {"error": "요청 시간 초과 (60초)", "manual_mode": True}
    except json.JSONDecodeError as e:
        return {"error": f"JSON 파싱 오류: {str(e)}", "manual_mode": True}
    except Exception as e:
        return {"error": f"오류: {str(e)}", "manual_mode": True}
