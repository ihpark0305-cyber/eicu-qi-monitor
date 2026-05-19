import json, os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

def _load(filename):
    with open(os.path.join(DATA_DIR, filename), encoding="utf-8") as f:
        return json.load(f)

def get_monthly_data():  return _load("monthly.json")
def get_weekly_data():   return _load("weekly.json")
def get_checklist():     return _load("checklist.json")
def get_incidents():     return _load("incidents.json")