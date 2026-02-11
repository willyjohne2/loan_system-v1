import requests
import base64
from datetime import datetime
import json
import os
from django.conf import settings


class MpesaHandler:
    def __init__(self):
        self.consumer_key = os.getenv("MPESA_CONSUMER_KEY", "")
        self.consumer_secret = os.getenv("MPESA_CONSUMER_SECRET", "")
        self.shortcode = os.getenv("MPESA_SHORTCODE", "")
        self.passkey = os.getenv("MPESA_PASSKEY", "")
        self.callback_url = os.getenv(
            "MPESA_CALLBACK_URL", "https://example.com/callback"
        )
        self.base_url = (
            "https://sandbox.safaricom.co.ke"
            if os.getenv("MPESA_ENV", "sandbox") == "sandbox"
            else "https://api.safaricom.co.ke"
        )

    def get_access_token(self):
        url = f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials"
        try:
            auth_string = f"{self.consumer_key}:{self.consumer_secret}"
            encoded_auth = base64.b64encode(auth_string.encode()).decode()

            headers = {"Authorization": f"Basic {encoded_auth}"}
            response = requests.get(url, headers=headers)
            return response.json().get("access_token")
        except Exception as e:
            print(f"Error getting access token: {str(e)}")
            return None

    def stk_push(self, phone_number, amount, account_reference, transaction_desc):
        access_token = self.get_access_token()
        if not access_token:
            return {"error": "Failed to get access token"}

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        password_str = self.shortcode + self.passkey + timestamp
        password = base64.b64encode(password_str.encode()).decode()

        url = f"{self.base_url}/mpesa/stkpush/v1/processrequest"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        # Format phone number to 254...
        if phone_number.startswith("0"):
            phone_number = "254" + phone_number[1:]
        elif phone_number.startswith("+"):
            phone_number = phone_number[1:]

        payload = {
            "BusinessShortCode": self.shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(amount),
            "PartyA": phone_number,
            "PartyB": self.shortcode,
            "PhoneNumber": phone_number,
            "CallBackURL": self.callback_url,
            "AccountReference": account_reference,
            "TransactionDesc": transaction_desc,
        }

        try:
            response = requests.post(url, json=payload, headers=headers)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    def mock_stk_push(phone_number, amount, account_reference):
        # This is for testing until they get real credentials
        return {
            "MerchantRequestID": "MOCK-" + datetime.now().strftime("%Y%m%d%H%M%S"),
            "ResponseCode": "0",
            "CustomerMessage": "Success. Please enter your Mpesa pin on your phone.",
            "status": "MOCK_SUCCESS",
        }
