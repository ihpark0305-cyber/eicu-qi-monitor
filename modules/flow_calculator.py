from datetime import datetime

def calculate_oxygen_charge(flow_records):
    segments = []
    total_liters = 0.0
    total_minutes = 0

    for i in range(len(flow_records) - 1):
        t1 = datetime.strptime(flow_records[i]["time"], "%H:%M")
        t2 = datetime.strptime(flow_records[i + 1]["time"], "%H:%M")
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