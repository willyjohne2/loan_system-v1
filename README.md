# Loan System API

This is a Django Rest Framework API for managing loans, users, and repayments. It is designed to work with an external PostgreSQL database.

## Setup Instructions

1. **Clone the repository**:

   ```bash
   git clone https://github.com/willyjohne2/loan_system-db.git
   cd loan_system-db
   ```

2. **Create a virtual environment**:

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   - Copy the `.env.example` file to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Open `.env` and fill in your PostgreSQL credentials and a secure `SECRET_KEY`.

5. **Run the server**:
   ```bash
   python manage.py runserver
   ```

## API Endpoints

- `POST /api/auth/login/` - Login to get JWT tokens.
- `GET /api/users/` - List/Create users.
- `GET /api/admins/` - List/Create admins.
- `GET /api/loans/` - List/Create loans.
- `GET /api/loan-products/` - List/Create loan products.
- `GET /api/repayments/` - List/Create repayments.
- `GET /api/audit-logs/` - List audit logs.

## Security

The API uses JWT authentication. Include the access token in the header of your requests:
`Authorization: Bearer <your_access_token>`
