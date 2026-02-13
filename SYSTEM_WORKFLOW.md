# Loan Management System - System Workflow Documentation

This document outlines the operational flow and business logic of the Loan Management System.

## 1. User Roles & Access Control (RBAC)

The system uses Role-Based Access Control to ensure data privacy and branch-level silos.

- **Super Admin**: Global access to all data, settings, audit logs, and member management.
- **Manager**: Branch-level access. Can only view and manage customers, loans, and repayments within their assigned **Branch**.
- **Field Officer**: Specific access. Can only view and manage customers they personally registered and loans they initiated.
- **Financial Officer**: Access to disbursement and repayment processing.

---

## 2. Customer Registration Flow ("Step 0" Logic)

To prevent double-registration and data duplication:

1.  **Search-First**: Before registering a new customer, the agent must enter a National ID or Phone Number.
2.  **Validation**:
    - If the user exists, the system retrieves their profile and checks for outstanding loans.
    - If the user does not exist, the registration form opens for new entry.
3.  **Outstanding Loan Check**: An existing user cannot apply for a new loan if they have an active or overdue loan.

---

## 3. Loan Application & Lifecycle

1.  **Application**: Field Officer initiates a loan application for a customer.
2.  **Safe Loan Limit**: The system automatically calculates a "Safe Limit" based on the customer's income.
    - _Logic_: Monthly repayment cannot exceed 33% (Debt-to-Income ratio) of the customer's monthly income over the requested duration.
3.  **Status Workflow**:
    - `UNVERIFIED` → Initial state.
    - `VERIFIED` → Passed initial checks.
    - `PENDING` → Awaiting final approval.
    - `AWARDED` → Approved and ready for disbursement.
    - `ACTIVE` → Loan disbursed, repayments ongoing.
    - `OVERDUE` → Missed repayment dates.
    - `CLOSED` → Loan fully repaid.
    - `REJECTED` → Application denied.

---

## 4. Interest, Penalties & Repayment

- **Base Interest**: Defined at the time of loan application or inherited from the Loan Product.
- **Overdue Penalties**: If a loan becomes overdue (detected at system check):
  - Status switches to `OVERDUE`.
  - A penalty rate (e.g., +2%) is added to the base interest rate.
  - Once the overdue amount is cleared, the rate reverts to the base rate.
- **Repayment Schedule**: Automated or manual generation of monthly installments based on duration.

---

## 5. Security & Authentication

- **Authentication**: Secure JWT (JSON Web Tokens) with a custom `CustomJWTAuthentication` provider.
- **Password Hashing**: Uses `bcrypt` for industry-standard security.
- **Email Verification**: New admins must verify their email with a 6-digit code before accessing the dashboard.
- **Password Reset**: Code-based reset (Request → Email Code → Reset) using Brevo SMTP.
- **Account Locking**: Accounts are blocked after 5 failed login attempts.

---

## 6. Technical Stack

- **Backend**: Django REST Framework (Python)
- **Frontend**: React.js (Vite)
- **Database**: PostgreSQL
- **Email Service**: Brevo (SMTP)
- **Static Files**: WhiteNoise
- **Hosting Recommendation**: Render/Railway (Backend) & Vercel/Netlify (Frontend).
