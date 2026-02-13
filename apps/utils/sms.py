import requests
import os
import threading
from django.conf import settings


class SMSHandler:
    def __init__(self):
        self.username = os.getenv("AT_USERNAME", "sandbox")
        self.api_key = os.getenv("AT_API_KEY", "")
        self.sender_id = os.getenv("AT_SENDER_ID", "")  # For Live use
        self.base_url = (
            "https://api.sandbox.africastalking.com"
            if self.username == "sandbox"
            else "https://api.africastalking.com"
        )
        if self.username == "sandbox":
            print(
                "[INFO] SMS handler initialized in SANDBOX mode. SMS will NOT be sent to real devices."
            )
        elif not self.api_key:
            print(
                "[WARNING] SMS handler initialized without API KEY. SMS will be MOCKED."
            )

    def send_sms(self, recipients, message):
        """
        recipients: list of phone numbers (e.g. ["+254712345678"])
        message: text content
        """
        if not self.api_key:
            # Mock success for demo purposes if no API key set
            print(f"MOCK SMS to {recipients}: {message}")
            return {"status": "success", "message": "Mock SMS sent successfully"}

        url = f"{self.base_url}/version1/messaging"
        headers = {
            "ApiKey": self.api_key,
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        }

        # Format recipients for AT (comma separated string)
        to_str = ",".join(recipients)

        data = {
            "username": self.username,
            "to": to_str,
            "message": message,
        }
        if self.sender_id:
            data["from"] = self.sender_id

        try:
            response = requests.post(url, data=data, headers=headers)
            return response.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}


def send_sms_async(recipients, message):
    """Utility to send SMS in background so it doesn't slow down the request"""
    handler = SMSHandler()
    thread = threading.Thread(target=handler.send_sms, args=(recipients, message))
    thread.start()
