import os
import pandas as pd
from flask import Flask, render_template, jsonify, request, send_file
from io import BytesIO
from modules.flow_calculator import calculate_oxygen_charge
from modules.data_loader import get_monthly_data, get_weekly_data, get_checklist, get_incidents
from modules.upload_parser import parse_upload, compare_files, read_df
from modules.ocr_parser import extract_from_image, MIME_MAP
from modules import scheduler as sch

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("home.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/api/trend")
def trend():
    period = request.args.get("period", "monthly")
    if period == "weekly":
        return jsonify(get_weekly_data())
    return jsonify(get_monthly_data())

@app.route("/api/checklist")
def checklist():
    return jsonify(get_checklist())

@app.route("/api/incidents")
def incidents():
    return jsonify(get_incidents())

@app.route("/api/flow-calc", methods=["POST"])
def flow_calc():
    data = request.get_json()
    records = data.get("records", [])
    result = calculate_oxygen_charge(records)
    return jsonify(result)

@app.route("/api/upload", methods=["POST"])
def upload():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "파일 없음"}), 400
    df, err = read_df(file)
    if err:
        return jsonify({"error": err}), 400
    result = parse_upload(df)
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)

@app.route("/api/compare", methods=["POST"])
def compare():
    f1 = request.files.get("ganhocheo")
    f2 = request.files.get("bulchul")
    if not f1 or not f2:
        return jsonify({"error": "두 파일 모두 필요합니다 (ganhocheo + bulchul)"}), 400
    df1, e1 = read_df(f1)
    df2, e2 = read_df(f2)
    if e1:
        return jsonify({"error": f"간호처방집계 오류: {e1}"}), 400
    if e2:
        return jsonify({"error": f"불출증 오류: {e2}"}), 400
    result = compare_files(df1, df2)
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)

@app.route("/api/test-groq")
def test_groq():
    import os, requests as req
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        return jsonify({"status": "error", "msg": "GROQ_API_KEY 없음"})
    try:
        res = req.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                "messages": [{"role": "user", "content": "안녕. 한국어로 짧게 답해줘."}],
                "max_tokens": 50
            },
            timeout=15
        )
        d = res.json()
        if "error" in d:
            return jsonify({"status": "error", "msg": d["error"].get("message", str(d["error"]))})
        return jsonify({"status": "ok", "reply": d["choices"][0]["message"]["content"]})
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)})

@app.route("/api/ocr-upload", methods=["POST"])
def ocr_upload():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "파일 없음"}), 400
    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in MIME_MAP:
        return jsonify({"error": "JPG/PNG/GIF/WEBP만 지원합니다"}), 400
    result = extract_from_image(file.read(), MIME_MAP[ext])
    return jsonify(result)

@app.route("/analysis")
def analysis():
    return render_template("analysis.html")

@app.route("/shift")
def shift():
    return render_template("shift.html")

@app.route("/report")
def report():
    return render_template("report.html")

@app.route("/settings")
def settings():
    return render_template("settings.html")

@app.route("/effects")
def effects():
    return render_template("effects.html")

@app.route("/demo")
def demo():
    return render_template("demo.html")

@app.route("/edit")
def edit():
    return render_template("edit.html")

@app.route("/api/read-excel", methods=["POST"])
def read_excel():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "파일 없음"}), 400
    df, err = read_df(file)
    if err:
        return jsonify({"error": err}), 400
    df = df.fillna("")
    return jsonify({"columns": df.columns.tolist(), "rows": df.to_dict("records")})

@app.route("/roster")
def roster():
    return render_template("roster.html")

@app.route("/api/roster/nurses")
def roster_nurses():
    return jsonify(sch.load_nurses())

@app.route("/api/roster/generate", methods=["POST"])
def roster_generate():
    data = request.get_json()
    year         = int(data.get("year",  2025))
    month        = int(data.get("month", 6))
    prev_tail    = data.get("prev_tail", {})
    fixed_leaves = data.get("fixed_leaves", {})
    result = sch.generate_schedule(year, month, prev_tail, fixed_leaves)
    return jsonify(result)

@app.route("/api/roster/validate", methods=["POST"])
def roster_validate():
    data      = request.get_json()
    year      = int(data.get("year",  2025))
    month     = int(data.get("month", 6))
    schedule  = data.get("schedule", {})
    prev_tail = data.get("prev_tail", {})
    nurses_data = sch.load_nurses()
    violations = sch.validate_schedule(schedule, year, month, prev_tail, nurses_data)
    return jsonify({"violations": violations})

@app.route("/api/roster/save", methods=["POST"])
def roster_save():
    data  = request.get_json()
    year  = int(data.get("year",  2025))
    month = int(data.get("month", 6))
    sch.save_schedule(year, month, data)
    return jsonify({"ok": True})

@app.route("/api/roster/load")
def roster_load():
    year  = int(request.args.get("year",  2025))
    month = int(request.args.get("month", 6))
    saved = sch.load_saved(year, month)
    if saved is None:
        return jsonify({"error": "저장된 근무표 없음"}), 404
    return jsonify(saved)

@app.route("/api/roster/export", methods=["POST"])
def roster_export():
    data     = request.get_json()
    year     = int(data.get("year",  2025))
    month    = int(data.get("month", 6))
    schedule = data.get("schedule", {})
    stats    = data.get("stats", {})
    xlsx_bytes = sch.export_excel(schedule, stats, year, month)
    return send_file(
        BytesIO(xlsx_bytes),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=f"근무표_{year}{month:02d}.xlsx"
    )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)