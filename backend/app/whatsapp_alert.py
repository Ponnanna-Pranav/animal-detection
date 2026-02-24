# backend/app/alerts.py
import os
from twilio.rest import Client

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM")
ALERT_PHONE = os.getenv("ALERT_PHONE")

# Only create client if creds exist (avoid crash)
client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def send_whatsapp_alert(animal: str, image_name: str, confidence: float) -> None:
    """
    Send a WhatsApp alert. If env vars or client are missing,
    just log and return without crashing.
    """
    if not client or not TWILIO_WHATSAPP_FROM or not ALERT_PHONE:
        print("Twilio not configured correctly, skipping WhatsApp alert.")
        return

    body = (
        "🚨 Animal Intrusion Alert!\n"
        f"Animal: {animal}\n"
        f"Confidence: {confidence * 100:.1f}%\n"
        f"Image: {image_name}"
    )

    try:
        msg = client.messages.create(
            from_=TWILIO_WHATSAPP_FROM,
            to=ALERT_PHONE,
            body=body,
        )
        print("WhatsApp alert sent, SID:", msg.sid)
    except Exception as e:
        # Important: DO NOT raise, or your API returns 500
        print("Failed to send WhatsApp alert:", e)
