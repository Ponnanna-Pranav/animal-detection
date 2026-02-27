import requests
import os
import time
from datetime import datetime

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

last_alert_time = 0
ALERT_COOLDOWN = 30  # seconds


def send_telegram_alert(animal: str, confidence: float, image_path: str):

    global last_alert_time

    if not BOT_TOKEN or not CHAT_ID:
        print("Telegram not configured")
        return

    current_time = time.time()
    if current_time - last_alert_time < ALERT_COOLDOWN:
        print("Telegram cooldown active")
        return

    last_alert_time = current_time

    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    message_text = f"""
🚨 ANIMAL INTRUSION ALERT 🚨

Animal: {animal.upper()}
Confidence: {confidence*100:.1f}%
Time: {timestamp}

⚠️ Immediate attention required!
"""

    try:
        # 1️⃣ SEND TEXT MESSAGE
        text_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"

        text_response = requests.post(
            text_url,
            data={
                "chat_id": CHAT_ID,
                "text": message_text
            }
        )

        print("Telegram text sent:", text_response.text)

        # 2️⃣ SEND PHOTO
        photo_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"

        with open(image_path, "rb") as photo:
            photo_response = requests.post(
                photo_url,
                data={
                    "chat_id": CHAT_ID,
                    "caption": "📸 Captured Image"
                },
                files={
                    "photo": photo
                }
            )

        print("Telegram photo sent:", photo_response.text)

    except Exception as e:
        print("Telegram error:", e)
