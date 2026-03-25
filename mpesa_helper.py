import requests
import json
import base64
import sys
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Configuration — You can edit these or they will be read from environment/input
CONSUMER_KEY = os.getenv('MPESA_CONSUMER_KEY', '0jAuALlZGIyerkUMFzlMRRc69bMKOKRIQ8Pd0CKy5HXozYkD')
CONSUMER_SECRET = os.getenv('MPESA_CONSUMER_SECRET', 'kKwwnzIxrrYoYwLuya0jgWfOfGgsWtylABjFe5HrqssNSQPG3GvVIWKRZhlL6H0l')
SHORTCODE = os.getenv('MPESA_SHORTCODE', '600982')
ENV = "sandbox" # or "production"

BASE_URL = "https://sandbox.safaricom.co.ke" if ENV == "sandbox" else "https://api.safaricom.co.ke"

def get_access_token():
    print("Locked and loaded... fetching access token...")
    url = f"{BASE_URL}/oauth/v1/generate?grant_type=client_credentials"
    try:
        credentials = f"{CONSUMER_KEY}:{CONSUMER_SECRET}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        headers = { "Authorization": f"Basic {encoded_credentials}" }
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        token = response.json()['access_token']
        print("Access Token acquired successfully.")
        return token
    except Exception as e:
        print(f"Failed to get access token: {e}")
        return None

def register_urls(domain_url):
    """
    Registers the Validation and Confirmation URLs for C2B.
    """
    token = get_access_token()
    if not token: return

    # Ensure domain ends with /
    if not domain_url.endswith('/'):
        domain_url += '/'
    
    # Construct full endpoints
    validation_url = f"{domain_url}api/payments/validation/"
    confirmation_url = f"{domain_url}api/payments/callback/"

    print(f"\nAttempting to register URLs:")
    print(f"Validation:   {validation_url}")
    print(f"Confirmation: {confirmation_url}")

    url = f"{BASE_URL}/mpesa/c2b/v1/registerurl"
    headers = { "Authorization": f"Bearer {token}", "Content-Type": "application/json" }
    payload = {
        "ShortCode": SHORTCODE,
        "ResponseType": "Completed", 
        "ConfirmationURL": confirmation_url,
        "ValidationURL": validation_url
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        print("\nSafaricom Response:")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error registering URLs: {e}")

def simulate_c2b(amount, bill_ref, phone="254708374149"):
    """
    Simulates a customer paying via Paybill.
    """
    token = get_access_token()
    if not token: return

    print(f"\nSimulating C2B Payment...")
    print(f"Amount: KES {amount}")
    print(f"Account/Ref: {bill_ref}")
    print(f"Payer: {phone}")

    url = f"{BASE_URL}/mpesa/c2b/v1/simulate"
    headers = { "Authorization": f"Bearer {token}", "Content-Type": "application/json" }
    payload = {
        "ShortCode": SHORTCODE,
        "CommandID": "CustomerPayBillOnline",
        "Amount": str(amount),
        "Msisdn": phone,
        "BillRefNumber": bill_ref
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        print("\nSafaricom Response:")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error simulating payment: {e}")

def mock_c2b(domain_url, amount, bill_ref, phone="254708374149"):
    """
    Directly mocks a C2B payment to the application, bypassing Safaricom Sandbox.
    Useful when Sandbox verification URLs are down.
    """
    if not domain_url.endswith('/'):
        domain_url += '/'
    
    confirmation_url = f"{domain_url}api/payments/callback/"
    
    print(f"\nSimulating Direct Mock Payment to: {confirmation_url}")
    print(f"Amount: KES {amount}")
    print(f"Account/Ref: {bill_ref}")
    
    # Generate a random transaction ID
    import random
    import string
    trans_id = 'MK' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
    
    payload = {
        "TransactionType": "Pay Bill",
        "TransID": trans_id,
        "TransTime": datetime.now().strftime("%Y%m%d%H%M%S"),
        "TransAmount": str(amount),
        "BusinessShortCode": SHORTCODE,
        "BillRefNumber": bill_ref,
        "InvoiceNumber": "",
        "OrgAccountBalance": "",
        "ThirdPartyTransID": "",
        "MSISDN": phone,
        "FirstName": "Mock",
        "MiddleName": "User",
        "LastName": "Test"
    }
    
    try:
        response = requests.post(confirmation_url, json=payload, headers={"Content-Type": "application/json"})
        print(f"Response Status: {response.status_code}")
        print("Application Response:", response.text)
        if response.status_code == 200:
            print(f"\n✅ Payment simulated successfully! Transaction ID: {trans_id}")
            print("Check your dashboard to see if the loan balance updated.")
        else:
            print("\n❌ Payment simulation failed.")
    except Exception as e:
        print(f"Error sending mock payment: {e}")

if __name__ == "__main__":
    print("--- M-Pesa Sandbox Helper ---")
    print("1. Register URLs (Connect Render to Safaricom) [Use only if Safaricom is UP]")
    print("2. Simulate Repayment (Through Safaricom) [Requires successful option 1]")
    print("3. Mock Direct Payment (Bypass Safaricom) [Use if Safaricom is DOWN/Unreachable]")
    choice = input("Select option (1, 2, or 3): ").strip()

    if choice == '1':
        domain = input("Enter your Render deployed URL (e.g., https://my-app.onrender.com): ").strip()
        if domain:
            register_urls(domain)
        else:
            print("Domain URL is required.")
            
    elif choice == '2':
        # Safaricom simulation
        amt = input("Enter Amount (KES): ").strip()
        ref = input("Enter BillRefNumber (e.g., Loan ID or National ID): ").strip()
        ph = input("Enter Phone (2547...): ").strip() or "254708374149"
        if amt and ref:
            simulate_c2b(amt, ref, ph)
        else:
            print("Amount and Ref Required.")

    elif choice == '3':
        # Direct Mock
        domain = input("Enter your Render deployed URL (e.g., https://my-app.onrender.com): ").strip()
        if not domain:
            print("Domain URL is required.")
            sys.exit(1)
            
        amt = input("Enter Amount (KES): ").strip()
        ref = input("Enter BillRefNumber (e.g., National ID or Loan ID): ").strip()
        ph = input("Enter Phone (2547...): ").strip() or "254708374149"
        
        if amt and ref:
            mock_c2b(domain, amt, ref, ph)
        else:
            print("Amount and Ref Required.")
    else:
        print("Invalid choice.")
