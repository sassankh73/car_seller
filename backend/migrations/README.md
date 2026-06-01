# Alembic Migrations

This directory contains Alembic database migrations for AutoStudio AI.

## Setup

1. Install required dependencies:
```bash
pip install -r requirements.txt
```

2. Configure database in `alembic.ini` if needed:
```
sqlalchemy.url = postgresql://user:password@host:port/database
```

## Usage

### Create a new migration
```bash
alembic revision -m "migration name"
```

### Run migrations
```bash
alembic upgrade head
```

### Rollback migrations
```bash
alembic downgrade -1
```

### Auto-generate migrations
```bash
alembic revision --autogenerate -m "migration name"