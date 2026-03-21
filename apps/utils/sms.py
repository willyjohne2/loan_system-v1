import requests
import os
import threading
from django.conf import settings
from .encryption import get_setting


class SMSHandler:
    def __init__(self):
        self.username = get_setting("AT_USERNAME", os.getenv("AT_USERNAME", "sandbox"))
        self.api_key = get_setting("AT_API_KEY", os.getenv("AT_API_KEY", ""))
        self.sender_id = get_setting("AT_SENDER_ID", os.getenv("AT_SENDER_ID", ""))
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
            res_json = response.json()
            # If the provider returns error details, bubble them up
            if response.status_code >= 400:
                return {"status": "error", "message": res_json.get("errorMessage", "Provider Error"), "details": res_json}
            return res_json
        except Exception as e:
            return {"status": "error", "message": f"Connection failed: {str(e)}"}


def send_invite_email_async(email, token, role, invited_by_name="System Admin", sender_user=None):
    try:
        sender_name = os.getenv("SENDER_NAME", "Azariah Credit Ltd")
        from_email = os.getenv("FROM_EMAIL")
        brevo_api_key = os.getenv("BREVO_API_KEY")
        # Ensure your FRONTEND_URL is set in environment, or defaults correctly
        invite_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/signup?token={token}&email={email}&role={role}"

        if not brevo_api_key or not from_email:
            print(f"[ERROR] Email setup missing for Invitation: BREVO_API_KEY={bool(brevo_api_key)}, FROM_EMAIL={bool(from_email)}")
            return

        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": brevo_api_key,
            "content-type": "application/json",
        }

        html_content = f"""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #4f46e5; text-align: center;">Administrative Invitation</h2>
                    <p>Hello,</p>
                    <p>You have been invited by <strong>{invited_by_name}</strong> to join <strong>{sender_name}</strong> as a <span style="color: #4f46e5; font-weight: bold;">{role}</span>.</p>
                    <p>Please click the link below to complete your registration:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{invite_url}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Invitation</a>
                    </div>
                    <p>If the button doesn't work, copy and paste this URL into your browser:</p>
                    <p style="word-break: break-all; color: #666; font-size: 0.9em;">{invite_url}</p>
                    <p style="margin-top: 30px; font-size: 0.85em; color: #888; border-top: 1px solid #eee; padding-top: 10px;">
                        This invitation will expire in 30 minutes.
                        <br/><br/>
                        Best regards,<br/>
                        <strong>{sender_name} Team</strong>
                    </p>
                </div>
                </body>
                </html>
            """

        payload = {
            "sender": {"name": sender_name, "email": from_email},
            "to": [{"email": email}],
            "subject": f"You've been invited as a {role} - {sender_name}",
            "htmlContent": html_content,
        }
        requests.post(url, json=payload, headers=headers)
        
        # Log the email for Official Communicator
        from ..models import EmailLog
        EmailLog.objects.create(
            sender=sender_user,
            recipient_email=email,
            recipient_name="Staff",
            subject=f"Invitation to join as {role}",
            message=html_content, # Log the HTML so it reflects what was sent
            status="SENT"
        )
    except Exception as e:
        print(f"Error sending invite email: {e}")


def send_sms_async(recipients, message):
    """Utility to send SMS in background so it doesn't slow down the request"""
    handler = SMSHandler()
    thread = threading.Thread(target=handler.send_sms, args=(recipients, message))
    thread.start()
