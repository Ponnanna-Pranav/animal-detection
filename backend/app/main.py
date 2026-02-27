# backend/app/main.py

from typing import Dict, Any, List
from pathlib import Path
from datetime import datetime
import os
import base64

from fastapi import FastAPI, UploadFile, File, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from twilio.rest import Client

from .detection import run_inference_on_image_bytes
from .database import Base, engine, SessionLocal
from .models_db import Detection as DetectionModel
from .schemas import DetectionOut
from app.services.telegram import send_telegram_alert


# =========================================================
# PATH CONFIGURATION (RENDER SAFE)
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

STORED_DIR = BASE_DIR / "stored_images"
STORED_DIR.mkdir(parents=True, exist_ok=True)


# =========================================================
# TWILIO CONFIGURATION
# =========================================================

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM")
ALERT_PHONE = os.getenv("ALERT_PHONE")

twilio_client = None

if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        twilio_client = Client(
            TWILIO_ACCOUNT_SID,
            TWILIO_AUTH_TOKEN
        )
        print("Twilio initialized")
    except Exception as e:
        print("Twilio init error:", e)


# =========================================================
# DANGEROUS ANIMALS LIST
# =========================================================

DANGEROUS_ANIMALS = {
    "tiger",
    "lion",
    "leopard",
    "bear",
    "wolf",
    "elephant",
}


# =========================================================
# FASTAPI INIT
# =========================================================

app = FastAPI(
    title="Animal Intrusion Detection API",
    version="1.0.0",
)


# =========================================================
# CORS CONFIGURATION (IMPORTANT FOR VERCEL)
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all for deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# DATABASE INIT
# =========================================================

Base.metadata.create_all(bind=engine)


def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/")
def root():

    return {

        "status": "running",
        "service": "Animal Intrusion Detection API"

    }


@app.get("/health")
def health():

    return {

        "status": "healthy"

    }


# =========================================================
# WHATSAPP ALERT FUNCTION
# =========================================================

def send_whatsapp_alert(
    animal: str,
    confidence: float,
    saved_path: Path
):

    if not twilio_client:
        print("Twilio not configured")
        return

    if not TWILIO_WHATSAPP_FROM or not ALERT_PHONE:
        print("WhatsApp config missing")
        return

    try:

        message = (

            f"⚠️ ALERT: {animal.upper()} detected!\n"
            f"Confidence: {confidence*100:.1f}%\n"
            f"Image: {saved_path.name}"

        )

        twilio_client.messages.create(

            from_=TWILIO_WHATSAPP_FROM,
            to=ALERT_PHONE,
            body=message

        )

        print("WhatsApp alert sent")

    except Exception as e:

        print("WhatsApp error:", e)


# =========================================================
# FILE UPLOAD DETECTION ENDPOINT
# =========================================================

@app.post("/predict")
async def predict_animal(

    file: UploadFile = File(...),
    db: Session = Depends(get_db)

) -> Dict[str, Any]:

    image_bytes = await file.read()

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    safe_name = file.filename.replace(" ", "_")

    filename = f"{timestamp}_{safe_name}"

    saved_path = UPLOAD_DIR / filename


    # save file
    with open(saved_path, "wb") as f:

        f.write(image_bytes)


    # run inference
    detections = run_inference_on_image_bytes(image_bytes)


    dangerous_found = False

    top_dangerous = None


    for det in detections:

        bbox = det.get("bbox", [0,0,0,0])

        animal = det.get("class_name","").lower()

        confidence = float(det.get("confidence",0))


        db_record = DetectionModel(

            filename=filename,
            animal=animal,
            confidence=confidence,

            x_min=bbox[0],
            y_min=bbox[1],
            x_max=bbox[2],
            y_max=bbox[3],

        )

        db.add(db_record)


        if any(danger in animal for danger in DANGEROUS_ANIMALS) and confidence >= 0.5:

            dangerous_found = True

            if top_dangerous is None or confidence > top_dangerous["confidence"]:

                top_dangerous = {

                    "animal": animal,
                    "confidence": confidence

                }


    db.commit()


    if dangerous_found and top_dangerous:

        send_telegram_alert(
            top_dangerous["animal"],
            top_dangerous["confidence"]
        )


    return {

        "filename": filename,
        "num_detections": len(detections),
        "detections": detections

    }


# =========================================================
# CAMERA BASE64 DETECTION ENDPOINT
# =========================================================

@app.post("/predict-base64")
async def predict_base64(

    data: dict = Body(...),
    db: Session = Depends(get_db)

):

    image_base64 = data.get("image")

    if not image_base64:

        return {"error": "No image received"}


    try:

        image_bytes = base64.b64decode(

            image_base64.split(",")[1]

        )

    except Exception:

        return {"error": "Invalid base64 image"}


    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    filename = f"camera_{timestamp}.jpg"

    saved_path = UPLOAD_DIR / filename


    with open(saved_path, "wb") as f:

        f.write(image_bytes)


    detections = run_inference_on_image_bytes(image_bytes)

    for det in detections:

        animal = det.get("class_name","").lower()
        confidence = float(det.get("confidence",0))
    
        if any(danger in animal for danger in DANGEROUS_ANIMALS) and confidence >= 0.5:
            send_telegram_alert(animal, confidence)
            break


    for det in detections:

        bbox = det.get("bbox", [0,0,0,0])

        db_record = DetectionModel(

            filename=filename,
            animal=det.get("class_name",""),
            confidence=float(det.get("confidence",0)),

            x_min=bbox[0],
            y_min=bbox[1],
            x_max=bbox[2],
            y_max=bbox[3],

        )

        db.add(db_record)


    db.commit()


    return {

        "filename": filename,
        "num_detections": len(detections),
        "detections": detections

    }


# =========================================================
# DETECTION HISTORY ENDPOINT
# =========================================================

@app.get("/detections", response_model=List[DetectionOut])
def get_detections(

    db: Session = Depends(get_db)

):

    records = (

        db.query(DetectionModel)
        .order_by(DetectionModel.created_at.desc())
        .limit(50)
        .all()

    )

    return records
