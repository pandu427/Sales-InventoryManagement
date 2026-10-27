# Sales & Inventory Management System

Full-stack starter implementation for the supplied assignment:
- React + Vite frontend
- FastAPI + SQLAlchemy backend
- MySQL supported; SQLite used by default for quick local testing
- JWT authentication with admin/manager/staff roles
- Product and customer CRUD
- Sales orders with stock validation
- Configurable approval threshold and manager approval/rejection
- SMTP email notifications (optional)
- Dashboard metrics
- Inventory changes only when an order is confirmed; approval and stock deduction are transactional

## Requirements
- Python 3.10+
- Node.js 18+
- MySQL 8+ (optional for local demo; SQLite works out of the box)

## 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

API docs: http://127.0.0.1:8000/docs

On first start, tables are created and demo users are seeded:
- `admin@example.com` / `Admin123!` (admin)
- `manager@example.com` / `Manager123!` (manager)
- `staff@example.com` / `Staff123!` (staff)

Change these credentials before deployment.

## 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (normally http://localhost:5173).

## 3. MySQL configuration

Create a database, for example `sales_inventory`, then set in `backend/.env`:

`DATABASE_URL=mysql+pymysql://username:password@localhost:3306/sales_inventory`

For SQLite testing, keep the default URL in `.env`.

## 4. Email

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `MANAGER_EMAIL` in `backend/.env`.
If SMTP is not configured, the app logs a warning and continues without sending email. Set `APPROVAL_THRESHOLD` to the amount above which manager approval is required.

## Notes
- This is an educational assignment implementation, not a production security review.
- Before production: use a secret manager, HTTPS, migrations (Alembic), rate limiting, audit logging, stronger password policy, tests, and deployment-specific CORS settings.
