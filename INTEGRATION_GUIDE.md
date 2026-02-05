# API & Database Integration Guide

This document explains how to connect the Express.js system to the Django Loan System API and the PostgreSQL database.

## 1. Connection Details

- **API Base URL:** `https://loan-system-api-0knv.onrender.com`
- **Database Connection String (PostgreSQL):**
  `postgresql://loan_sytem_db_user:QqPUj19561h5nMkUFuGRwwkyzAdamUnI@dpg-d61eo14r85hc7399gmu0-a.oregon-postgres.render.com/loan_sytem_db`
- **GitHub Repository:** `https://github.com/willyjohne2/loan_system-db.git` (Includes `database_schema.sql`)

---

## 2. Authentication (JWT)

All endpoints (except login) require a Bearer Token.

### Login Request

**POST** `/api/auth/login/`

```json
{
  "email": "njugunawilson977@gmail.com",
  "password": "27580072@willy"
}
```

**Response:** Returns an `access` and `refresh` token. Use the `access` token for subsequent requests.

---

## 3. Working with API Endpoints (Express.js Examples)

### A. Fetching Users or Repayments

Include the token in the `Authorization` header.

```javascript
const axios = require("axios");

async function getUsers(token) {
  try {
    const response = await axios.get(
      "https://loan-system-api-0knv.onrender.com/api/users/",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching users:", error.response.data);
  }
}
```

### B. Submitting a New Loan / Form Data

```javascript
async function applyForLoan(token, loanData) {
  try {
    const response = await axios.post(
      "https://loan-system-api-0knv.onrender.com/api/loans/",
      loanData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error("Submission failed:", error.response.data);
  }
}
```

---

## 4. Endpoint Reference Table

| Feature        | Method   | Path                  | Description               |
| :------------- | :------- | :-------------------- | :------------------------ |
| **Login**      | POST     | `/api/auth/login/`    | Get JWT tokens            |
| **Users**      | GET/POST | `/api/users/`         | Manage loan customers     |
| **Loans**      | GET/POST | `/api/loans/`         | Manage loan applications  |
| **Repayments** | GET/POST | `/api/repayments/`    | Register loan payments    |
| **Products**   | GET/POST | `/api/loan-products/` | Manage loan types/rates   |
| **Audit Logs** | GET      | `/api/audit-logs/`    | View system activity logs |

---

## 5. Direct Database Access (SQL)

If Express.js needs to run complex joins or raw queries, use the connection string provided in Section 1 with libraries like `pg` or `knex`.

Example `pg` connection:

```javascript
const { Pool } = require("pg");
const pool = new Pool({
  connectionString:
    "postgresql://loan_sytem_db_user:QqPUj19561h5nMkUFuGRwwkyzAdamUnI@dpg-d61eo14r85hc7399gmu0-a.oregon-postgres.render.com/loan_sytem_db",
  ssl: { rejectUnauthorized: false }, // Required for Render connections
});
```
