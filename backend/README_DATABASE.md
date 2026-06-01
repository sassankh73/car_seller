# Database Setup for AutoStudio AI

## Prerequisites

- PostgreSQL 14+ installed and running
- Python 3.10+

## Setup Instructions

### 1. Create Database and User

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE autostudio;

-- Create user
CREATE USER autostudio WITH PASSWORD 'autostudio';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE autostudio TO autostudio;
```

### 2. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure Environment

Create a `.env` file in the `backend` directory with:

```env
DATABASE_URL=postgresql://autostudio:autostudio@localhost:5432/autostudio
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

### 4. Run Migrations

```bash
cd backend
alembic upgrade head
```

### 5. Initialize Database (if not using migrations)

```bash
cd backend
python -c "from app.models import init_db; init_db()"
```

## Database Schema

### Tables

- **users**: User accounts with authentication
- **projects**: Car studio projects owned by users
- **subscriptions**: User subscription plans
- **usages**: Usage tracking for billing

## Testing

```bash
# Run the backend server
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Production Database

For production, use a production-grade PostgreSQL database (e.g., AWS RDS, Google Cloud SQL):

```env
DATABASE_URL=postgresql://prod_user:prod_password@prod-host:5432/autostudio
SECRET_KEY=strong-random-key-generated-for-production