import requests
import base64
from django.utils import timezone
import json
import os
from django.conf import settings
from .encryption import get_setting


class MpesaHandler:
    def __init__(self):
        # Keys are stored in lowercase in DB (from seed/frontend), so we check lowercase first
        self.consumer_key = get_setting("mpesa_consumer_key", get_setting("MPESA_CONSUMER_KEY", getattr(settings, "MPESA_CONSUMER_KEY", "")))
        self.consumer_secret = get_setting("mpesa_consumer_secret", get_setting("MPESA_CONSUMER_SECRET", getattr(settings, "MPESA_CONSUMER_SECRET", "")))
        self.shortcode = get_setting("mpesa_shortcode", get_setting("MPESA_SHORTCODE", getattr(settings, "MPESA_SHORTCODE", "")))
        self.passkey = get_setting("mpesa_passkey", get_setting("MPESA_PASSKEY", getattr(settings, "MPESA_PASSKEY", "")))
        self.b2c_shortcode = get_setting(
            "mpesa_b2c_shortcode", 
            os.getenv('MPESA_B2C_SHORTCODE', '600996')
        )
        self.initiator_name = get_setting("mpesa_initiator_name", get_setting("MPESA_INITIATOR_NAME", getattr(settings, "MPESA_INITIATOR_NAME", "testapi")))
        self.initiator_password = get_setting(
             "mpesa_initiator_password", get_setting("MPESA_INITIATOR_PASSWORD", getattr(settings, "MPESA_INITIATOR_PASSWORD", "Safaricom007*"))
        )
        self.callback_url = get_setting("mpesa_callback_url", get_setting("MPESA_CALLBACK_URL", getattr(settings, "MPESA_CALLBACK_URL", "")))

        env = get_setting("mpesa_environment", get_setting("MPESA_ENVIRONMENT", getattr(settings, "MPESA_ENVIRONMENT", "sandbox")))
        self.base_url = (
            "https://sandbox.safaricom.co.ke"
            if env == "sandbox"
            else "https://api.safaricom.co.ke"
        )

    def get_access_token(self):
        url = f"{self.base_url}/oauth/v1/generate?grant_type=client_credentials"
        try:
            auth_string = f"{self.consumer_key}:{self.consumer_secret}"
            encoded_auth = base64.b64encode(auth_string.encode()).decode()

            headers = {"Authorization": f"Basic {encoded_auth}"}
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json().get("access_token")
        except Exception as e:
            print(f"Error getting access token: {str(e)}")
            return None

    def format_phone(self, phone):
        """Format phone number to 254... format"""
        phone = str(phone).strip()
        if phone.startswith("+"):
            phone = phone[1:]
        if phone.startswith("0"):
            phone = "254" + phone[1:]
        elif phone.startswith("7") or phone.startswith("1"):
            phone = "254" + phone
        return phone

    def stk_push(self, phone_number, amount, account_reference, transaction_desc):
        access_token = self.get_access_token()
        if not access_token:
            return {"error": "Failed to get access token"}

        timestamp = timezone.now().strftime("%Y%m%d%H%M%S")
        password_str = self.shortcode + self.passkey + timestamp
        password = base64.b64encode(password_str.encode()).decode()

        url = f"{self.base_url}/mpesa/stkpush/v1/processrequest"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        phone_number = self.format_phone(phone_number)

        payload = {
            "BusinessShortCode": self.shortcode,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(float(amount)),
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

    def b2c_disburse(
        self,
        phone_number,
        amount,
        CommandID="BusinessPayment",
        Remarks="Loan Disbursement",
    ):
        """
        Pay out money to a customer (B2C)
        """
        access_token = self.get_access_token()
        if not access_token:
            return {
                "ResponseCode": "999",
                "ResponseDescription": "M-Pesa Authentication Failed. Check your Consumer Key/Secret.",
            }

        url = f"{self.base_url}/mpesa/b2c/v3/paymentrequest"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        phone_number = self.format_phone(phone_number)

        # Generate a unique OriginatorConversationID (Required by Safaricom for tracking)
        originator_id = (
            f"AZA_{timezone.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(4).hex()}"
        )

        payload = {
            "OriginatorConversationID": originator_id,
            "InitiatorName": self.initiator_name,
            "SecurityCredential": self.initiator_password,
            "CommandID": CommandID,
            "Amount": int(float(amount)),
            "PartyA": self.b2c_shortcode,
            "PartyB": phone_number,
            "Remarks": Remarks,
            "QueueTimeOutURL": self.callback_url,
            "ResultURL": self.callback_url,
            "Occasion": "Disbursement",
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=15)
            if response.status_code != 200:
                print(f"Safaricom Error {response.status_code}: {response.text}")
                return {
                    "ResponseCode": str(response.status_code),
                    "ResponseDescription": f"Safaricom {response.status_code}: {response.text[:50]}",
                    "FullError": (
                        response.json()
                        if response.headers.get("Content-Type") == "application/json"
                        else response.text
                    ),
                }
            return response.json()
        except Exception as e:
            print(f"B2C Execution Error: {str(e)}")
            return {
                "ResponseCode": "500",
                "ResponseDescription": f"System Error: {str(e)[:50]}",
            }

    @staticmethod
    def mock_stk_push(phone_number, amount, account_reference):
        # This is for testing until they get real credentials
        return {
            "MerchantRequestID": "MOCK-" + timezone.now().strftime("%Y%m%d%H%M%S"),
            "ResponseCode": "0",
            "CustomerMessage": "Success. Please enter your Mpesa pin on your phone.",
            "status": "MOCK_SUCCESS",
        }
