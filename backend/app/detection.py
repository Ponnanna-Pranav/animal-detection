from pathlib import Path
from typing import List, Dict, Any

from ultralytics import YOLO
import numpy as np
import cv2


# =========================================================
# MODEL PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

ANIMAL_MODEL_PATH = BASE_DIR / "models" / "best.pt"
HUMAN_MODEL_PATH = BASE_DIR / "models" / "yolov8s.pt"   # 🔥 FIXED


# =========================================================
# LOAD MODELS (LOAD ONCE)
# =========================================================

if not ANIMAL_MODEL_PATH.exists():
    raise FileNotFoundError(f"Animal model not found at {ANIMAL_MODEL_PATH}")

if not HUMAN_MODEL_PATH.exists():
    raise FileNotFoundError(f"Human model not found at {HUMAN_MODEL_PATH}")

print(f"[INFO] Loading animal model from: {ANIMAL_MODEL_PATH}")
animal_model = YOLO(str(ANIMAL_MODEL_PATH))

print(f"[INFO] Loading human model from: {HUMAN_MODEL_PATH}")
human_model = YOLO(str(HUMAN_MODEL_PATH))

print("[INFO] Both models loaded successfully ✅")


# =========================================================
# INFERENCE FUNCTION
# =========================================================

def run_inference_on_image_bytes(image_bytes: bytes) -> List[Dict[str, Any]]:

    try:
        # Decode image
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Failed to decode image")

        detections: List[Dict[str, Any]] = []

        # =====================================================
        # 🟢 ANIMAL DETECTION
        # =====================================================
        animal_results = animal_model.predict(img, conf=0.5, iou=0.5, verbose=False)

        for result in animal_results:
            if result.boxes is None:
                continue

            for box in result.boxes:
                confidence = float(box.conf[0])
                if confidence < 0.5:
                    continue

                x1, y1, x2, y2 = box.xyxy[0].tolist()
                class_id = int(box.cls[0])
                class_name = animal_model.names[class_id]

                detections.append({
                    "class_name": class_name,
                    "confidence": confidence,
                    "bbox": [x1, y1, x2, y2]
                })

        # =====================================================
        # 🔴 HUMAN DETECTION
        # =====================================================
        human_results = human_model.predict(img, conf=0.6, iou=0.5, verbose=False)

        for result in human_results:
            if result.boxes is None:
                continue

            for box in result.boxes:
                class_id = int(box.cls[0])
                label = human_model.names[class_id]

                if label != "person":
                    continue

                confidence = float(box.conf[0])
                if confidence < 0.6:
                    continue

                x1, y1, x2, y2 = box.xyxy[0].tolist()

                detections.append({
                    "class_name": "human",
                    "confidence": confidence,
                    "bbox": [x1, y1, x2, y2]
                })

        # =====================================================
        # 🔥 ALERT SYSTEM
        # =====================================================
        for det in detections:
            if det["class_name"] in ["lion", "tiger", "bear"]:
                print("⚠️ ALERT: Dangerous animal detected!")

        print(f"[INFO] Detection complete. Found {len(detections)} objects.")

        return detections

    except Exception as e:
        print("[ERROR] Inference failed:", str(e))
        return []
