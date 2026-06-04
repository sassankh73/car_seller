# Role Enum Migration Plan

## Current State (PostgreSQL Database)

The PostgreSQL `role` enum type has these values:
```
ADMIN
PREMIUM
FREE
```

## Previous (Broken) Backend Enum

The backend previously used these Python Role enum values:
```
super_admin → caused "invalid input value for enum role: super_admin"
admin       → mapped to lowercase, not matching DB's ADMIN
dealer      → not in DB enum at all
user        → caused "invalid input value for enum role: USER"
```

## Current (Fixed) Backend Enum

The backend now matches the database exactly:
```python
class Role(str, Enum):
    ADMIN = "ADMIN"
    PREMIUM = "PREMIUM"
    FREE = "FREE"
```

## Role Mapping Reference

| Old Role | New Role | DB Value | Description |
|----------|----------|----------|-------------|
| `super_admin` | `ADMIN` | `ADMIN` | Full administrative access |
| `admin` | `ADMIN` | `ADMIN` | (merged with super_admin) |
| `dealer` | `PREMIUM` | `PREMIUM` | Premium/paid features |
| `user` | `FREE` | `FREE` | Default free-tier user |

## Future Migration: Adding More Roles

If more granular roles are needed in the future, the PostgreSQL enum must be altered first:

```sql
-- Add a new role value (cannot be done inside a transaction in most PG versions)
ALTER TYPE role ADD VALUE 'NEW_ROLE' BEFORE 'FREE';

-- After adding the DB enum value, update the Python Role enum
```

**Important**: PostgreSQL enum values are case-sensitive. The current values are
UPPERCASE (`ADMIN`, `PREMIUM`, `FREE`). Any new values should follow this convention.

## Existing Data Migration

Existing users with role `FREE` (the DB default since the migration
`423cc45866e8`) are already compatible. No data migration was needed.

The admin user created by `ensure_admin_user()` now gets `Role.ADMIN` which
matches the DB's `ADMIN` enum value.

## Files Modified

### Backend
1. `backend/app/models/__init__.py` — Role enum + default + SQLEnum name
2. `backend/app/api/admin.py` — All role references and validation
3. `backend/app/middleware/auth.py` — Admin role checks
4. `backend/app/main.py` — ensure_admin_user + /api/auth/me fallback
5. `backend/app/schemas/auth.py` — UserResponse default role

### Frontend
6. `frontend/app/[locale]/admin/users/page.tsx` — ROLES array + role checks
7. `frontend/app/[locale]/admin/dashboard/page.tsx` — Admin role check
8. `frontend/context/AuthContext.tsx` — Fallback role values

## Rollback Plan

If rollback is needed, revert the 8 files above. The database enum is unchanged
and requires no rollback.