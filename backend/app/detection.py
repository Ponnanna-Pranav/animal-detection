from pathlib import Path
from typing import List, Dict, Any

from ultralytics import YOLO
import numpy as np
import cv2


# =========================================================
# MODEL PATH SETUP (ABSOLUTE, SAFE)
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
MODEL_PATH = BASE_DIR / "models" / "best.pt"

if not MODEL_PATH.exists():
    raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")

print(f"[INFO] Loading YOLO model from: {MODEL_PATH}")

# Load model once globally
model = YOLO(str(MODEL_PATH))

print("[INFO] Model loaded successfully")


# =========================================================
# INFERENCE FUNCTION
# =========================================================

def run_inference_on_image_bytes(image_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Runs YOLO inference on image bytes.
    Returns:
        [
          {
            "class_name": str,
            "confidence": float,
            "bbox": [x1, y1, x2, y2]
          }
        ]
    """

    try:

        # Convert bytes → numpy array
        np_arr = np.frombuffer(image_bytes, np.uint8)

        # Decode image using OpenCV
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Failed to decode image")

        # Run YOLO inference
        results = model(img)

        detections: List[Dict[str, Any]] = []

        for result in results:

            boxes = result.boxes

            if boxes is None:
                continue

            for box in boxes:

                x1, y1, x2, y2 = box.xyxy[0].tolist()

                confidence = float(box.conf[0])

                class_id = int(box.cls[0])

                class_name = model.names[class_id]

                detections.append({

                    "class_name": class_name,
                    "confidence": confidence,
                    "bbox": [x1, y1, x2, y2]

                })

        print(f"[INFO] Detection complete. Found {len(detections)} objects.")

        return detections

    except Exception as e:

        print("[ERROR] Inference failed:", str(e))

        return []