import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import certifi
import joblib
import pandas as pd
import google.generativeai as genai

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

load_dotenv()

# ---------------------------------------------------------------- MODEL
MODEL_DIR = Path(__file__).parent

model = joblib.load(MODEL_DIR / "care_action_model.pkl")
label_encoder = joblib.load(MODEL_DIR / "label_encoder.pkl")

FEATURES = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
]

# ---------------------------------------------------------------- FASTAPI
app = FastAPI(title="Adaptive Care Pathway API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://smart-care-pathway.vercel.app",
    ],
    allow_origin_regex=r"https://smart-care-pathway.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------- MONGODB
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError(
        "MONGO_URI is not set. Add it to backend/.env or to your hosting "
        "environment variables."
    )

mongo_options = {}
# tlsCAFile switches TLS on, so use it only for Atlas-style connections.
if MONGO_URI.startswith("mongodb+srv://") or "tls=true" in MONGO_URI.lower():
    mongo_options["tlsCAFile"] = certifi.where()

mongo_client = AsyncIOMotorClient(MONGO_URI, **mongo_options)
db = mongo_client["care_pathway_db"]
patients_collection = db["patients"]

# ---------------------------------------------------------------- GEMINI
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel(
    os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
)


# ---------------------------------------------------------------- INPUT MODELS
class VitalsInput(BaseModel):
    pregnancies: int = Field(ge=0, le=30)
    glucose: float = Field(ge=0, le=700)
    blood_pressure: float = Field(ge=0, le=300)
    skin_thickness: float = Field(ge=0, le=150)
    insulin: float = Field(ge=0, le=1500)
    bmi: float = Field(ge=0, le=100)
    diabetes_pedigree_function: float = Field(ge=0, le=10)
    age: int = Field(ge=1, le=120)


class PatientInput(BaseModel):
    name: str


# ---------------------------------------------------------------- HELPERS
def to_object_id(patient_id: str) -> ObjectId:
    try:
        return ObjectId(patient_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid patient ID")


def create_prediction(vitals: VitalsInput):
    row = pd.DataFrame([{
        "Pregnancies": vitals.pregnancies,
        "Glucose": vitals.glucose,
        "BloodPressure": vitals.blood_pressure,
        "SkinThickness": vitals.skin_thickness,
        "Insulin": vitals.insulin,
        "BMI": vitals.bmi,
        "DiabetesPedigreeFunction": vitals.diabetes_pedigree_function,
        "Age": vitals.age,
    }])[FEATURES]

    try:
        probabilities = model.predict_proba(row)[0]
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Model inference failed: {e}"
        )

    prediction_index = probabilities.argmax()
    care_action = label_encoder.inverse_transform([prediction_index])[0]
    confidence = round(float(probabilities[prediction_index]), 4)

    return care_action, confidence


def parse_ai_json(text: str) -> dict:
    """Parse JSON from the AI, tolerating code fences or extra text."""
    cleaned = (text or "").strip()
    cleaned = re.sub(
        r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE
    ).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end > start:
            return json.loads(cleaned[start:end + 1])
        raise


def clean_text(value) -> str:
    return " ".join(str(value).split())


def clean_string_list(report: dict, key: str) -> list:
    items = report.get(key)
    if not isinstance(items, list) or not items:
        raise ValueError(f"'{key}' must be a non-empty list")
    cleaned = []
    for item in items:
        if not isinstance(item, str) or not item.strip():
            raise ValueError(f"'{key}' contains an invalid entry")
        cleaned.append(clean_text(item))
    return cleaned


def clean_schedule(report: dict, key: str, fields: list) -> list:
    items = report.get(key)
    if not isinstance(items, list) or not items:
        raise ValueError(f"'{key}' must be a non-empty list")
    cleaned = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError(f"'{key}' contains an invalid entry")
        entry = {}
        for field in fields:
            value = item.get(field)
            if value is None or not str(value).strip():
                raise ValueError(f"'{key}' entry is missing '{field}'")
            entry[field] = clean_text(value)
        cleaned.append(entry)
    return cleaned


def validate_ai_report(report) -> dict:
    if not isinstance(report, dict):
        raise ValueError("AI response was not a JSON object")

    summary = report.get("condition_summary")
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("Missing condition_summary")

    return {
        "condition_summary": clean_text(summary),
        "keywords": clean_string_list(report, "keywords"),
        "diet_schedule": clean_schedule(
            report, "diet_schedule", ["time", "meal", "food"]
        ),
        "exercise_schedule": clean_schedule(
            report, "exercise_schedule", ["time", "activity", "duration"]
        ),
        "precautions": clean_string_list(report, "precautions"),
    }


def bullet_list(items: list) -> str:
    return "\n".join(f"- {item}" for item in items)


# ---------------------------------------------------------------- ROUTES
@app.get("/")
def health_check():
    return {"status": "ok", "message": "API is running"}


@app.get("/test-db")
async def test_db():
    try:
        await mongo_client.admin.command("ping")
        return {"status": "connected to MongoDB"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"DB connection failed: {e}"
        )


@app.post("/patients")
async def create_patient(patient: PatientInput):
    name = patient.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Patient name is required")

    result = await patients_collection.insert_one(
        {"name": name, "vitals_history": []}
    )
    return {"id": str(result.inserted_id), "name": name}


@app.post("/recommend")
def recommend(vitals: VitalsInput):
    care_action, confidence = create_prediction(vitals)
    return {"care_action": care_action, "confidence": confidence}


@app.post("/patients/{patient_id}/vitals")
async def add_vitals(patient_id: str, vitals: VitalsInput):
    object_id = to_object_id(patient_id)
    care_action, confidence = create_prediction(vitals)

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "vitals": vitals.dict(),
        "care_action": care_action,
        "confidence": confidence,
    }

    result = await patients_collection.update_one(
        {"_id": object_id},
        {"$push": {"vitals_history": entry}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")

    return entry


@app.get("/patients/{patient_id}")
async def get_patient(patient_id: str):
    object_id = to_object_id(patient_id)

    patient = await patients_collection.find_one({"_id": object_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient["_id"] = str(patient["_id"])
    return patient


# ------------------------------------------- AI EXPLANATION + TIMETABLES
@app.post("/patients/{patient_id}/explain")
async def explain_condition(patient_id: str):
    object_id = to_object_id(patient_id)

    patient = await patients_collection.find_one({"_id": object_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    history = patient.get("vitals_history", [])
    if not history:
        raise HTTPException(status_code=400, detail="No vitals recorded yet")

    latest = history[-1]
    v = latest["vitals"]
    care_action = latest["care_action"]

    prompt = f"""You are a clinical health information assistant. Create a personalized diabetes lifestyle report.

PATIENT READINGS
- Glucose: {v.get('glucose')} mg/dL
- BMI: {v.get('bmi')}
- Blood pressure: {v.get('blood_pressure')}
- Age: {v.get('age')}
- Insulin: {v.get('insulin')}
- Pregnancies: {v.get('pregnancies')}
- Skin thickness: {v.get('skin_thickness')}
- Diabetes pedigree function: {v.get('diabetes_pedigree_function')}

ML CARE ACTION: {care_action}

Return ONLY a JSON object with exactly these keys:
{{
  "condition_summary": "2-3 plain sentences explaining what the readings suggest and why this care action was recommended",
  "keywords": ["3 to 6 short phrases, max 5 words each"],
  "diet_schedule": [{{"time": "7:00 AM", "meal": "Breakfast", "food": "specific foods, max 12 words"}}],
  "exercise_schedule": [{{"time": "6:30 AM", "activity": "specific activity", "duration": "20 minutes"}}],
  "precautions": ["3 to 5 short precautions"]
}}

RULES
1. diet_schedule: 5 or 6 entries covering breakfast, morning snack, lunch, evening snack and dinner (optionally a bedtime item), in time order.
2. exercise_schedule: 2 or 3 entries in time order, with safe and realistic activities.
3. Use 12-hour times with AM/PM. Use specific, affordable foods. Replace every example value above with real content.
4. Personalise to the readings. Do not prescribe medication or doses, and never advise stopping prescribed medication.
5. Do not claim a confirmed diabetes diagnosis.
6. If exercise may need medical clearance, say so in the precautions.
7. No empty arrays and no text outside the JSON."""

    report = None
    last_error = None

    for _ in range(2):  # one automatic retry if the AI reply is unusable
        try:
            response = await gemini_model.generate_content_async(
                prompt,
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0.4,
                },
            )
            report = validate_ai_report(parse_ai_json(response.text))
            break
        except Exception as e:
            last_error = e

    if report is None:
        raise HTTPException(
            status_code=502,
            detail=f"AI report generation failed: {last_error}",
        )

    explanation = (
        "## Condition Summary\n\n"
        f"{report['condition_summary']}\n\n"
        "## Key Health Indicators\n\n"
        f"{bullet_list(report['keywords'])}\n\n"
        "## Diet & Lifestyle Plan\n\n"
        "Your meal and exercise timetable is included in the downloadable "
        "PDF report.\n\n"
        "## Precautions\n\n"
        f"{bullet_list(report['precautions'])}\n"
    )

    return {
        "assessment_focus": "Diabetes",
        "explanation": explanation,
        "keywords": report["keywords"],
        "diet_schedule": report["diet_schedule"],
        "exercise_schedule": report["exercise_schedule"],
        "precautions": report["precautions"],
    }