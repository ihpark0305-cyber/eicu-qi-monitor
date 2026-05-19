import os
from flask import Flask, render_template, jsonify, request
from modules.flow_calculator import calculate_oxygen_charge
from modules.data_loader import get_monthly_data, get_weekly_data, get_checklist, get_incidents

app = Flask(__name__)

@app.route("/")
def index():
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

@app.route("/analysis")
def analysis():
    return render_template("analysis.html")

@app.route("/shift")
def shift():
    return render_template("shift.html")

@app.route("/report")
def report():
    return render_template("report.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)