# Loan System - M-Pesa Integration Testing Guide

This guide walks you through verifying your M-Pesa integration in Sandbox mode before going live to Production.

## Phase 1: Connection Verification
**Goal:** Ensure your system can talk to Safaricom's API.

1.  Log in to the **Owner's Dashboard**.
2.  Navigate to **Settings** > **M-Pesa**.
3.  Scroll down to the **Connection Diagnosis** section.
4.  Click **Test Connectivity Now**.
    *   **Success:** You will see a green checkmark, your API Token, and the masked configuration details.
    *   **Failure:** Check your Consumer Key/Secret. Ensure your server IP is whitelisted on Safaricom Developer Portal if required (though Sandbox usually allows any IP).

## Phase 2: End-to-End Transaction Test
**Goal:** Verify money movement (Registration -> Disbursement -> Repayment).

### Step 1: Register a Test Customer
1.  Go to the **Users** section.
2.  Add a new user manually.
3.  **Crucial:** Use one of the **Safaricom Test Phone Numbers** provided in your developer account (e.g., `254708374149` or similar). Do NOT use your personal number for Sandbox testing as it often fails unless whitelisted.

### Step 2: Disburse a Loan (B2C)
1.  Create a Loan Application for this new user.
2.  Approve the loan.
3.  Click **Disburse via M-Pesa**.
4.  **Verification:**
    *   The system should show "Disbursement Successful".
    *   Since this is Sandbox, no real money moves.
    *   Check **Audit Logs** or **M-Pesa Logs** to see if the callback was received with a success status.

### Step 3: Repay the Loan (C2B)
*Since you cannot initiate a real payment from a test phone without a SIM card, you must SIMULATE it.*

**Option A: Using Safaricom Developer Portal (Recommended)**
1.  Go to [Safaricom Developer Portal](https://developer.safaricom.co.ke/test_credentials).
2.  Navigate to **APIs** > **M-Pesa Express** (STK Push) or **C2B** (Paybill).
3.  Use the **Simulate Transaction** feature.
    *   **Shortcode:** Your Sandbox Shortcode (e.g., `600981`).
    *   **Amount:** The loan repayment amount (e.g., `500`).
    *   **Phone Number:** The test customer's number (`254...`).
    *   **BillRefNumber:** The Loan ID or Reference Number from your system (essential for linking the payment!).
4.  Click **Send Request**.
5.  Your system should receive the callback and update the loan status to "PAID" or "PARTIALLY PAID".

**Option B: Using STK Push (if implemented)**
1.  If your system has a "Trigger Payment" button for the user:
2.  Click it to send an STK Push to the test phone.
3.  Open the [M-Pesa G2 API Simulator](https://developer.safaricom.co.ke/test_credentials) to simulate the customer entering their PIN.

## Phase 3: Go Live
Once Phase 1 and 2 are successful:
1.  Go to **Settings** > **M-Pesa**.
2.  Switch Environment to **Production**.
3.  Update credentials (Key, Secret, Passkey) to your Production values.
4.  Switch Shortcode Type to **Paybill** or **Till** as per your real contract.
