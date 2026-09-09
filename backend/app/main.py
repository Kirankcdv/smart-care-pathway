from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import certifi

load_dotenv()

MODEL_DIR = Path(__file__).parent
model = joblib.load(MODEL_DIR / "care_action_model.pkl")
label_encoder = joblib.load(MODEL_DIR / "label_encoder.pkl")

FEATURES = [
    "Pregnancies", "Glucose", "BloodPressure", "SkinThickness",
    "Insulin", "BMI", "DiabetesPedigreeFunction", "Age",
]

app = FastAPI(title="Adaptive Care Pathway API")
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

mongo_client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
db = mongo_client["care_pathway_db"]
patients_collection = db["patients"]


class VitalsInput(BaseModel):
    pregnancies: int
    glucose: float
    blood_pressure: float
    skin_thickness: float
    insulin: float
    bmi: float
    diabetes_pedigree_function: float
    age: int


class PatientInput(BaseModel):
    name: str


@app.get("/")
def health_check():
    return {"status": "ok", "message": "API is running"}


@app.get("/test-db")
async def test_db():
    try:
        await mongo_client.admin.command("ping")
        return {"status": "connected to MongoDB"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB connection failed: {e}")


@app.post("/patients")
async def create_patient(patient: PatientInput):
    result = await patients_collection.insert_one({"name": patient.name, "vitals_history": []})
    return {"id": str(result.inserted_id), "name": patient.name}


@app.post("/recommend")
def recommend(vitals: VitalsInput):
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
        probs = model.predict_proba(row)[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {e}")

    pred_idx = probs.argmax()
    care_action = label_encoder.inverse_transform([pred_idx])[0]

    return {
        "care_action": care_action,
        "confidence": round(float(probs[pred_idx]), 4),
    }
from datetime import datetime, timezone
from bson import ObjectId


@app.post("/patients/{patient_id}/vitals")
async def add_vitals(patient_id: str, vitals: VitalsInput):
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
        probs = model.predict_proba(row)[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference failed: {e}")

    pred_idx = probs.argmax()
    care_action = label_encoder.inverse_transform([pred_idx])[0]
    confidence = round(float(probs[pred_idx]), 4)

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "vitals": vitals.dict(),
        "care_action": care_action,
        "confidence": confidence,
    }

    result = await patients_collection.update_one(
        {"_id": ObjectId(patient_id)},
        {"$push": {"vitals_history": entry}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Patient not found")

    return entry


@app.get("/patients/{patient_id}")
async def get_patient(patient_id: str):
    patient = await patients_collection.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient["_id"] = str(patient["_id"])
    return patient
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel("gemini-3.6-flash")


@app.post("/patients/{patient_id}/explain")
async def explain_condition(patient_id: str):
    patient = await patients_collection.find_one({"_id": ObjectId(patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    history = patient.get("vitals_history", [])
    if not history:
        raise HTTPException(status_code=400, detail="No vitals recorded yet for this patient")

    latest = history[-1]
    v = latest["vitals"]
    care_action = latest["care_action"]

    prompt = f"""You are a clinical assistant helping explain a diabetes patient's condition to their care team.

Patient's latest readings:
- Glucose: {v['glucose']} mg/dL
- BMI: {v['bmi']}
- Blood Pressure: {v['blood_pressure']}
- Age: {v['age']}
- Insulin: {v['insulin']}

The recommendation system has flagged this patient's care action as: "{care_action}"

Write a clear, structured explanation with two sections:
1. "Condition Summary" - explain in plain language what these readings suggest and why this care action was recommended.
2. "Diet & Lifestyle Plan" - give a practical, specific diet and lifestyle plan suited to this reading (e.g. foods to include/avoid, activity suggestions).

Keep it concise, empathetic, and easy for a patient to understand. Do not give exact medication dosages."""

    try:
        response = gemini_model.generate_content(prompt)
        explanation_text = response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI explanation failed: {e}")

    return {"explanation": explanation_text}