"""
upload_parser.py
불출증 / 간호처방집계 파일 파싱 및 분석 모듈
실제 서식 확인 기준 (2026-05-18):
  - 불출증:      물품코드, 물품명, 발주수량(=청구량), 기배송, 출고량, 미출고량
  - 간호처방집계: 처방코드, 처방명, 청구수량(입원), 반납수량, 실수량
"""
import pandas as pd

# ── 형식 감지 컬럼 ──────────────────────────────────────────────
BULCHUL_MUST   = {"출고량", "미출고량"}
BULCHUL_EXTRA  = {"물품명", "물품코드", "발주수량", "청구량", "기배송"}

GANHOCHEO_MUST  = {"실수량", "반납수량"}
GANHOCHEO_EXTRA = {"처방명", "처방코드", "청구수량"}

# ── 연속형 항목 키워드 ──────────────────────────────────────────
CONTINUOUS_KEYWORDS = [
    "산소", "oxygen", "o2", "hfnc", "고유량", "high flow",
    "인공호흡기", "ventilator", "breathing circuit", "pb980",
    "crrt", "지속적 신대체", "인공호흡",
    "1hour", "hour", "fio2", "l/1",
]

# ── 비교용 키워드 그룹 ──────────────────────────────────────────
ITEM_GROUPS = {
    "산소":     ["산소", "o2", "oxygen", "nasal cannula", "hour", "fio2", "l/1"],
    "인공호흡기": ["인공호흡기", "ventilator", "breathing circuit", "pb980"],
    "HFNC":    ["hfnc", "고유량", "high flow"],
    "CRRT":    ["crrt", "지속적 신대체"],
    "드레싱":   ["드레싱", "opsite", "betafoam", "allevyn", "tegaderm", "chg", "hisorb"],
    "카테터":   ["catheter", "카테터", "insyte", "angio"],
    "흡인":    ["suction", "흡인", "closed suction"],
}

DEFAULT_UNIT_COST = 3000  # 추정값 · 실측 단가 없는 경우 기본 적용


# ── 파일 읽기 헬퍼 ──────────────────────────────────────────────
def read_df(file):
    """파일 객체를 받아 DataFrame과 에러 메시지 반환"""
    name = file.filename.lower() if hasattr(file, "filename") else ""
    try:
        if name.endswith((".xlsx", ".xls")):
            df = pd.read_excel(file)
        elif name.endswith(".csv"):
            try:
                df = pd.read_csv(file, encoding="utf-8-sig")
            except UnicodeDecodeError:
                file.seek(0)
                df = pd.read_csv(file, encoding="euc-kr")
        else:
            return None, "지원하지 않는 파일 형식 (CSV, XLSX만 가능)"
        # 컬럼명 정규화: 괄호 내용 제거 + strip
        df.columns = df.columns.str.replace(r"\(.*?\)", "", regex=True).str.strip()
        return df, None
    except Exception as e:
        return None, f"파일 읽기 오류: {str(e)}"


# ── 형식 감지 ───────────────────────────────────────────────────
def detect_type(cols):
    cols_set = {c.strip() for c in cols}
    if BULCHUL_MUST.issubset(cols_set):
        return "불출증"
    if GANHOCHEO_MUST.issubset(cols_set):
        return "간호처방집계"
    return None


# ── 불출증 컬럼 정규화: 발주수량 → 청구량 ─────────────────────────
def normalize_bulchul_cols(df):
    if "발주수량" in df.columns and "청구량" not in df.columns:
        df = df.rename(columns={"발주수량": "청구량"})
    return df


# ── 연속형 키워드 판별 ──────────────────────────────────────────
def is_continuous(name: str) -> bool:
    n = str(name).lower()
    return any(k in n for k in CONTINUOUS_KEYWORDS)


# ── 비교용 키워드 그룹 분류 ─────────────────────────────────────
def classify_item(name: str) -> str:
    u = str(name).lower()
    for group, kws in ITEM_GROUPS.items():
        if any(k.lower() in u for k in kws):
            return group
    return "기타"


# ── 공통 KPI 딕셔너리 생성 ─────────────────────────────────────
def make_kpi(match_rate, evening_rate, delay_cost, period_label):
    return {
        "match_rate":      round(match_rate, 1),
        "evening_rate":    round(evening_rate, 1),
        "checklist_rate":  0,
        "delay_cost":      int(delay_cost),
        "delta_match":     0,
        "delta_evening":   0,
        "delta_checklist": 0,
        "delta_delay_cost": 0,
        "period_label":    period_label,
    }


# ── 단독 분석 ───────────────────────────────────────────────────
def parse_upload(df):
    upload_type = detect_type(df.columns)
    if upload_type is None:
        return {"error": "파일 형식을 인식할 수 없습니다. 불출증 또는 간호처방집계 파일을 사용해주세요."}

    if upload_type == "불출증":
        return _parse_bulchul(df)
    else:
        return _parse_ganhocheo(df)


def _parse_bulchul(df):
    df = normalize_bulchul_cols(df)

    # 필수 컬럼 확인
    for col in ["청구량", "출고량", "미출고량"]:
        if col not in df.columns:
            return {"error": f"불출증 필수 컬럼 없음: {col}"}

    df["청구량"]  = pd.to_numeric(df["청구량"],  errors="coerce").fillna(0)
    df["출고량"]  = pd.to_numeric(df["출고량"],  errors="coerce").fillna(0)
    df["미출고량"] = pd.to_numeric(df["미출고량"], errors="coerce").fillna(0)

    total_req = df["청구량"].sum()
    total_out = df["출고량"].sum()
    total_miss = df["미출고량"].sum()

    match_rate = round(total_out / total_req * 100, 1) if total_req > 0 else 0
    delay_cost = int(total_miss * DEFAULT_UNIT_COST)

    delay_items = []
    continuous_items = []
    name_col = "물품명" if "물품명" in df.columns else None

    for _, row in df.iterrows():
        name = str(row.get(name_col, "")) if name_col else ""
        miss = row["미출고량"]
        if miss > 0:
            cont = is_continuous(name)
            highlight = "orange" if cont else "red"
            item = {
                "item":      name or "(항목명 없음)",
                "cause":     f"미출고 {int(miss)}건 (청구 {int(row['청구량'])} → 출고 {int(row['출고량'])})",
                "shift":     "업로드",
                "severity":  "high" if miss >= 2 else "medium",
                "highlight": highlight,
                "status":    "review",
            }
            delay_items.append(item)
            if cont:
                continuous_items.append(item)

    # 날짜 추출 (처방기간 또는 발주일자 컬럼)
    date_str = _extract_date(df)

    return {
        "upload_type":      "불출증",
        "date":             date_str,
        "total_items":      len(df),
        "match_rate":       match_rate,
        "delay_items":      delay_items,
        "missing_items":    [],
        "continuous_items": continuous_items,
        "match_note":       "출고량/청구량 기준 집계 · 실제 사용-반영 일치 여부는 간호처방집계 병행 확인 필요",
        "cost_note":        f"단가 미확인 항목은 {DEFAULT_UNIT_COST:,}원 기본 적용",
        "kpi":              make_kpi(match_rate, 0, delay_cost, date_str),
    }


def _parse_ganhocheo(df):
    # 필수 컬럼 확인
    for col in ["실수량", "반납수량"]:
        if col not in df.columns:
            return {"error": f"간호처방집계 필수 컬럼 없음: {col}"}

    # 청구수량 컬럼 탐색 (이름 변형 허용)
    qty_col = None
    for c in df.columns:
        if "청구수량" in c or "청구량" in c:
            qty_col = c
            break
    if qty_col is None:
        return {"error": "청구수량 컬럼을 찾을 수 없습니다."}

    df[qty_col]   = pd.to_numeric(df[qty_col],  errors="coerce").fillna(0)
    df["실수량"]   = pd.to_numeric(df["실수량"],  errors="coerce").fillna(0)
    df["반납수량"] = pd.to_numeric(df["반납수량"], errors="coerce").fillna(0)

    total_req  = df[qty_col].sum()
    total_real = df["실수량"].sum()

    match_rate  = round(total_real / total_req * 100, 1) if total_req > 0 else 0
    delay_cost  = 0

    code_col = "처방코드" if "처방코드" in df.columns else None
    name_col = "처방명"  if "처방명"  in df.columns else None
    eve_col  = "이브닝cost" if "이브닝cost" in df.columns else None

    delay_items     = []
    missing_items   = []
    continuous_items = []

    for _, row in df.iterrows():
        name = str(row.get(name_col, "")) if name_col else ""
        req  = row[qty_col]
        real = row["실수량"]
        code = row.get(code_col, None) if code_col else None
        cont = is_continuous(name)

        # 처방 미입력 감지
        if code_col and (pd.isna(code) or str(code).strip() == "") and real > 0:
            item = {
                "item":      name or "(항목명 없음)",
                "cause":     "처방 미입력 의심 (처방코드 없음, 실수량 > 0)",
                "shift":     "업로드",
                "severity":  "medium",
                "highlight": "yellow",
                "status":    "review",
            }
            missing_items.append(item)
            continue

        # 실수량 < 청구수량 → 반영 지연
        if real < req:
            eve_flag = eve_col and str(row.get(eve_col, "")).strip().upper() == "N"
            highlight = "orange" if cont else ("yellow" if eve_flag else "red")
            item = {
                "item":      name or "(항목명 없음)",
                "cause":     f"실수량 {int(real)} < 청구수량 {int(req)}" + (" · 이브닝cost 미처리" if eve_flag else ""),
                "shift":     "업로드",
                "severity":  "high" if (req - real) >= 2 else "medium",
                "highlight": highlight,
                "status":    "review",
            }
            delay_items.append(item)
            delay_cost += int((req - real) * DEFAULT_UNIT_COST)
            if cont:
                continuous_items.append(item)

    # 연속형 항목 이브닝 처리율 계산
    cont_rows = df[df[name_col].apply(is_continuous)] if name_col else pd.DataFrame()
    if len(cont_rows) > 0 and qty_col in cont_rows.columns:
        cont_req  = cont_rows[qty_col].sum()
        cont_real = cont_rows["실수량"].sum()
        evening_rate = round(cont_real / cont_req * 100, 1) if cont_req > 0 else 0
    else:
        evening_rate = 0

    date_str = _extract_date(df)

    return {
        "upload_type":      "간호처방집계",
        "date":             date_str,
        "total_items":      len(df),
        "match_rate":       match_rate,
        "delay_items":      delay_items,
        "missing_items":    missing_items,
        "continuous_items": continuous_items,
        "match_note":       "실수량/청구수량 기준 집계 · 출고량과의 비교는 불출증 병행 업로드 필요",
        "cost_note":        f"단가 미확인 항목은 {DEFAULT_UNIT_COST:,}원 기본 적용",
        "kpi":              make_kpi(match_rate, evening_rate, delay_cost, date_str),
    }


# ── 교차 비교 분석 ──────────────────────────────────────────────
def compare_files(df_g, df_b):
    """간호처방집계(df_g) + 불출증(df_b) 키워드 그룹 기준 수량 비교"""
    df_b = normalize_bulchul_cols(df_b)

    name_g = "처방명" if "처방명" in df_g.columns else None
    name_b = "물품명" if "물품명" in df_b.columns else None

    # 청구수량 컬럼 탐색
    qty_g = None
    for c in df_g.columns:
        if "청구수량" in c or "청구량" in c:
            qty_g = c; break
    qty_b = "청구량" if "청구량" in df_b.columns else None

    if name_g is None:
        return {"error": "간호처방집계에서 처방명 컬럼을 찾을 수 없습니다."}
    if name_b is None:
        return {"error": "불출증에서 물품명 컬럼을 찾을 수 없습니다."}

    df_g["실수량"] = pd.to_numeric(df_g.get("실수량", 0), errors="coerce").fillna(0)
    df_b["출고량"] = pd.to_numeric(df_b.get("출고량", 0), errors="coerce").fillna(0)

    df_g["그룹"] = df_g[name_g].apply(classify_item)
    df_b["그룹"] = df_b[name_b].apply(classify_item)

    g_sum = df_g.groupby("그룹")["실수량"].sum().reset_index(name="처방_실수량")
    b_sum = df_b.groupby("그룹")["출고량"].sum().reset_index(name="불출_출고량")

    merged = pd.merge(g_sum, b_sum, on="그룹", how="outer").fillna(0)
    merged["차이"] = merged["불출_출고량"] - merged["처방_실수량"]
    merged["highlight"] = merged["차이"].apply(
        lambda x: "red" if x > 0 else ("green" if x == 0 else "orange")
    )

    all_items  = merged.to_dict("records")
    diff_items = merged[merged["차이"] != 0].to_dict("records")
    total      = len(merged)
    match_rate = round((total - len(diff_items)) / total * 100, 1) if total > 0 else 0
    delay_cost = int(merged["차이"].abs().sum() * DEFAULT_UNIT_COST)
    date_str   = str(pd.Timestamp.now().date())

    return {
        "upload_type":   "비교분석",
        "date":          date_str,
        "total_items":   total,
        "match_rate":    match_rate,
        "diff_count":    len(diff_items),
        "diff_items":    diff_items,
        "all_items":     all_items,
        "delay_items":   diff_items,
        "missing_items": [],
        "continuous_items": [],
        "match_note":    "키워드 그룹 기준 수량 비교 · 품목명 불일치 항목은 수동 확인 필요",
        "cost_note":     f"단가 미확인 항목은 {DEFAULT_UNIT_COST:,}원 기본 적용",
        "kpi":           make_kpi(match_rate, 0, delay_cost, date_str),
    }


# ── 날짜 추출 헬퍼 ──────────────────────────────────────────────
def _extract_date(df):
    for col in ["처방기간", "발주일자", "조회기간", "청구일자", "날짜"]:
        if col in df.columns:
            val = df[col].dropna().iloc[0] if len(df[col].dropna()) > 0 else None
            if val is not None:
                return str(val)[:10]
    return str(pd.Timestamp.now().date())
