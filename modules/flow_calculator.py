from datetime import datetime

FIO2_TO_FLOW = {
    21: 0, 24: 1, 28: 2, 31: 3,
    35: 4, 40: 6, 44: 8, 50: 10, 60: 12
}

def fio2_to_flow(fio2_percent: int) -> float:
    """FiO₂(%) → 추정 Flow(L/min) 변환. 중간값은 선형보간."""
    keys = sorted(FIO2_TO_FLOW.keys())
    if fio2_percent <= keys[0]:
        return float(FIO2_TO_FLOW[keys[0]])
    if fio2_percent >= keys[-1]:
        return float(FIO2_TO_FLOW[keys[-1]])
    for i in range(len(keys) - 1):
        lo, hi = keys[i], keys[i + 1]
        if lo <= fio2_percent <= hi:
            ratio = (fio2_percent - lo) / (hi - lo)
            return round(FIO2_TO_FLOW[lo] + ratio * (FIO2_TO_FLOW[hi] - FIO2_TO_FLOW[lo]), 1)
    return 0.0

def calculate_oxygen_charge(flow_records):
    segments = []
    total_liters = 0.0
    total_minutes = 0

    for i in range(len(flow_records) - 1):
        try:
            t1 = datetime.strptime(flow_records[i]["time"], "%H:%M")
            t2 = datetime.strptime(flow_records[i + 1]["time"], "%H:%M")
        except (ValueError, KeyError):
            continue
        minutes = int((t2 - t1).seconds / 60)
        hours = minutes / 60
        flow = flow_records[i]["flow"]
        if flow is None:
            continue
        volume = round(hours * flow, 3)
        total_liters += volume
        total_minutes += minutes
        segments.append({
            "from": flow_records[i]["time"],
            "to": flow_records[i + 1]["time"],
            "flow": flow,
            "minutes": minutes,
            "volume": volume,
        })

    return {
        "segments": segments,
        "total_liters": round(total_liters, 2),
        "total_minutes": total_minutes,
        "charge_item": "산소흡입료",
        "auto_generated": True,
        "note": "EMR 처치 변경 기록 기반 자동 계산",
    }