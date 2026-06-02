# AutoStudio AI — Deployment Guide

## Quick Start (VPS)

```bash
# 1. Clone the repository
git clone <your-repo-url> && cd car_sellers

# 2. Create environment file from template
cp backend/.env.example backend/.env

# 3. Edit .env with your production values (at minimum change these):
#    - SECRET_KEY       → generate a strong random key
#    - ADMIN_PASSWORD   → set a secure admin password
#    - DATABASE_URL     → confirm it points to postgres:5432 (default for Docker)
#    - FRONTEND_URL     → set to your domain if not localhost
#    - APP_URL          → set to your backend URL if not localhost

# 4. Start all services
docker compose up -d --build

# 5. Verify everything is running
docker compose ps
docker logs car_backend --tail 50
```

That's it. `git clone → configure env → docker compose up -d` is sufficient.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│               docker-compose.yml             │
│                                              │
│  postgres:5432  ←  backend:8001  ← frontend:3000  │
│       ↑                ↑                     │
│  postgres_data     rembg:7000               │
│  (named volume)                              │
└──────────────────────────────────────────────┘
```

| Service   | Port | Purpose                    |
|-----------|------|----------------------------|
| postgres  | 5432 | PostgreSQL database         |
| rembg     | 7000 | Background removal service  |
| backend   | 8001 | FastAPI backend API         |
| frontend  | 3000 | Next.js frontend            |

---

## Required Environment Variables

These are set in `backend/.env` (see `backend/.env.example` for the full template):

| Variable               | Required | Default (Docker)                                  | Description                        |
|------------------------|----------|---------------------------------------------------|------------------------------------|
| `DATABASE_URL`         | ✅ Yes   | `postgresql://autostudio_user:autostudio@postgres:5432/autostudio` | PostgreSQL connection string |
| `SECRET_KEY`           | ✅ Yes   | —                                                 | JWT signing key (generate randomly) |
| `ADMIN_PASSWORD`       | ✅ Yes   | —                                                 | Bootstrap admin password           |
| `ALGORITHM`            | No       | `HS256`                                           | JWT algorithm                       |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `1440`                                     | Token expiry in minutes            |
| `APP_NAME`             | No       | `AutoStudio AI`                                   | Application name                   |
| `APP_URL`              | No       | `http://localhost:8000`                            | Backend public URL                 |
| `FRONTEND_URL`         | No       | `http://localhost:3000`                             | Frontend public URL                |
| `ENABLE_REMBG`         | No       | `true`                                            | Enable background removal          |
| `BG_REMOVAL_ENGINE`    | No       | `rembg`                                           | BG removal engine                  |
| `REMBG_SERVICE_URL`    | No       | `http://rembg:7000`                               | Rembg service URL                  |
| `STRIPE_SECRET_KEY`    | No*      | —                                                 | Stripe secret key                   |
| `STRIPE_WEBHOOK_SECRET`| No*      | —                                                 | Stripe webhook secret               |

*Required for billing features.

---

## Database Configuration

### Option A: Docker PostgreSQL (default, recommended)

The `docker-compose.yml` includes a `postgres` service. The default `DATABASE_URL` points to it:

```
DATABASE_URL=postgresql://autostudio_user:autostudio@postgres:5432/autostudio
```

PostgreSQL data is persisted in a Docker named volume (`postgres_data`). This survives container restarts and rebuilds.

### Option B: External PostgreSQL

If you prefer an external database server:

1. Set `DATABASE_URL` to point to your external host:
   ```
   DATABASE_URL=postgresql://autostudio_user:YOUR_PASSWORD@YOUR_DB_HOST:5432/autostudio
   ```

2. Ensure the external PostgreSQL:
   - Accepts connections from the VPS IP address
   - Has `autostudio` database created
   - Has `autostudio_user` with appropriate permissions
   - `pg_hba.conf` allows connections from the VPS
   - Firewall allows port 5432 from the VPS

3. Remove the `postgres` service from `docker-compose.yml` (optional) or just leave it — the backend only uses `DATABASE_URL`.

---

## Verification Commands

After deploying, run these commands to verify connectivity:

```bash
# Check all containers are running and healthy
docker compose ps

# Check backend can reach postgres
docker exec car_backend python -c "
import psycopg2
conn = psycopg2.connect('postgresql://autostudio_user:autostudio@postgres:5432/autostudio')
print('DB connection: OK')
conn.close()
"

# Check postgres is ready
docker exec car_postgres pg_isready -U autostudio_user -d autostudio

# Check backend startup logs (should show "Startup complete")
docker logs car_backend --tail 50

# Test the health endpoint
curl -f http://localhost:8001/health

# Check rembg service
curl -f http://localhost:7000
```

---

## Troubleshooting

### Backend exits with "DATABASE_URL is not set"
- Ensure `backend/.env` exists and contains `DATABASE_URL`
- Copy the template: `cp backend/.env.example backend/.env`

### Backend exits with "Cannot connect to database"
- Ensure the `postgres` container is healthy: `docker compose ps postgres`
- Check postgres logs: `docker logs car_postgres --tail 30`
- Verify `DATABASE_URL` points to the correct host (`postgres` inside Docker)

### Backend exits with "connection to server at 192.168.0.106 failed"
- You have a stale `DATABASE_URL` pointing to a development LAN address
- Fix it: `DATABASE_URL=postgresql://autostudio_user:autostudio@postgres:5432/autostudio`

### Frontend can't reach backend
- Ensure `BACKEND_HOST=backend` and `BACKEND_PORT=8001` in frontend environment
- Or if accessing directly from browser, set the backend URL appropriately

---

## Rollback

If a deployment causes issues:

```bash
# Revert all code changes
git checkout HEAD -- docker-compose.yml backend/.env backend/app/models/__init__.py \
  backend/app/main.py backend/Dockerfile backend/alembic.ini backend/migrations/env.py

# Stop everything and remove the postgres volume (WARNING: destroys DB data)
docker compose down -v

# Redeploy
docker compose up -d --build
```

---

## Production Security Checklist

- [ ] Generate a strong `SECRET_KEY` (not the default)
- [ ] Set a strong `ADMIN_PASSWORD` (not the default)
- [ ] Restrict `FRONTEND_URL` and `APP_URL` to your actual domain
- [ ] Set Stripe keys to live keys (not test)
- [ ] Restrict CORS origins in `backend/app/main.py` (not `*`)
- [ ] Change default PostgreSQL password in docker-compose.yml
- [ ] Ensure `backend/.env` is not committed to git (already in `.gitignore`)
- [ ] Set up HTTPS (reverse proxy with nginx/caddy)
- [ ] Consider removing the `5432` port exposure on postgres if only accessed from Docker