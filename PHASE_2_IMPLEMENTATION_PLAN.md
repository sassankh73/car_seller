# Phase 2 Implementation Plan

## Overview
This document outlines the architecture and implementation plan for Phase 2 of the AutoStudio AI platform, focusing on admin capabilities, user management, and role-based access control.

---

## 1. Admin Dashboard

### Database Changes
- **New Table: `admin_logs`**
  - id (INTEGER, PK)
  - user_id (INTEGER, FK to users)
  - action (VARCHAR) - e.g., "user_disabled", "user_enabled", "role_changed"
  - description (TEXT)
  - timestamp (DATETIME)

### Backend APIs
- `GET /api/admin/dashboard/stats` - Dashboard statistics
  - Response: total_users, active_users, total_projects, revenue_stats
- `GET /api/admin/dashboard/recent-activity` - Recent admin actions
- `GET /api/admin/dashboard/system-health` - System metrics

### Frontend Pages
- `/admin/dashboard/page.tsx` - Main admin dashboard with stats cards
- `/admin/dashboard/components/StatCard.tsx` - Reusable stats component
- `/admin/dashboard/components/ActivityFeed.tsx` - Recent activity feed

### Security Considerations
- Admin role required (only users with `role = 'admin'` can access)
- All actions logged for audit trail
- Rate limiting on admin endpoints
- Admin routes protected with `@require_admin` decorator

### Estimated Effort: 2-3 days

---

## 2. User Role System

### Database Changes
- **Modified `users` table:**
  - `role` (ENUM: 'free', 'premium', 'admin', default 'free')
  - `is_disabled` (BOOLEAN, default false)
  - `is_superuser` (BOOLEAN, default false)
- **New Table: `user_role_history`**
  - id (INTEGER, PK)
  - user_id (INTEGER, FK)
  - old_role (VARCHAR)
  - new_role (VARCHAR)
  - changed_by (INTEGER, FK to admin users)
  - timestamp (DATETIME)

### Backend APIs
- `GET /api/users/roles` - List all available roles
- `PATCH /api/users/{id}/role` - Update user role (admin only)
- `GET /api/users/{id}/role-history` - Get role change history

### Frontend Pages
- User profile page with role display
- Admin panel for role management

### Security Considerations
- Role hierarchy: admin > premium > free
- Role changes logged in `user_role_history` table
- Admin role cannot be changed by non-admins
- is_disabled flag prevents user login

### Estimated Effort: 1 day

---

## 3. Subscription Synchronization with Stripe

### Database Changes
- **Modified `subscriptions` table:**
  - `stripe_subscription_id` (VARCHAR, unique)
  - `stripe_customer_id` (VARCHAR)
  - `plan_tier` (ENUM: 'BASIC', 'PROFESSIONAL', 'ENTERPRISE')
  - `status` (VARCHAR: 'active', 'paused', 'cancelled', 'expired')
  - `current_period_start` (DATETIME)
  - `current_period_end` (DATETIME)
- **New Table: `stripe_webhook_logs`**
  - id (INTEGER, PK)
  - event_type (VARCHAR)
  - event_data (JSON)
  - processed (BOOLEAN)
  - timestamp (DATETIME)

### Backend APIs
- `POST /api/billing/webhook` - Stripe webhook endpoint
- `GET /api/billing/status` - Get subscription status
- `POST /api/billing/cancel` - Cancel subscription
- `GET /api/billing/resume` - Resume paused subscription

### Frontend Pages
- `/dashboard/billing/status-page.tsx` - Subscription status display
- `/dashboard/billing/upgrade-modal.tsx` - Upgrade UI

### Security Considerations
- Webhook signature verification for Stripe events
- Server-side validation of subscription status
- Sync webhook events to database
- Prevent unauthorized subscription modifications

### Estimated Effort: 2-3 days

---

## 4. Usage Limits Enforcement

### Database Changes
- **Modified `usage_limits` table:**
  - `image_count` (INTEGER)
  - `max_images` (INTEGER)
  - `extra_studios_used` (INTEGER)
  - `logo_branding_used` (INTEGER)
  - `premium_ai_uses` (INTEGER)
  - `four_k_exports` (INTEGER)
- **New Table: `usage_logs`**
  - id (INTEGER, PK)
  - user_id (INTEGER, FK)
  - action (VARCHAR)
  - count (INTEGER)
  - timestamp (DATETIME)

### Backend APIs
- `GET /api/usage/check` - Check current usage vs limits
- `GET /api/usage/logs` - Get usage history
- `POST /api/usage/reset` - Reset usage counter (admin)

### Frontend Pages
- Usage display in dashboard
- Upgrade prompt when limits approaching

### Security Considerations
- Server-side usage tracking (not client-side only)
- Usage counters reset on new billing cycle
- Premium users get higher limits
- Usage logs for billing reconciliation

### Estimated Effort: 2 days

---

## 5. User Management Tools

### Database Changes
- **Existing tables used:** `users`, `subscriptions`, `projects`
- **New Table: `user_search_history`** (for admin analytics)

### Backend APIs
- `GET /api/admin/users` - List users with pagination
- `GET /api/admin/users/{id}` - Get user details
- `PATCH /api/admin/users/{id}/disable` - Disable user
- `PATCH /api/admin/users/{id}/enable` - Enable user
- `PATCH /api/admin/users/{id}/role` - Change user role
- `GET /api/admin/users/search` - Search users by email/name

### Frontend Pages
- `/admin/users/page.tsx` - User management table
- `/admin/users/[id]/page.tsx` - User details page
- User search and filter components

### Security Considerations
- Admin-only endpoints
- Audit logging for all user modifications
- Soft delete (is_disabled) rather than hard delete
- Cannot disable own account (prevent lockout)

### Estimated Effort: 2 days

---

## 6. Project Management Tools

### Database Changes
- **Existing tables used:** `projects`, `users`, `projects_studios`
- **New Table: `project_search_history`**

### Backend APIs
- `GET /api/admin/projects` - List all projects (admin)
- `GET /api/admin/projects/{id}` - Get project details
- `DELETE /api/admin/projects/{id}` - Delete project
- `GET /api/admin/users/{id}/projects` - Get user's projects

### Frontend Pages
- `/admin/projects/page.tsx` - Project management view
- Project detail modal

### Security Considerations
- Admin-only access to view all projects
- Audit logging for deletions
- User can only see own projects (except admin)

### Estimated Effort: 1-2 days

---

## 7. Analytics Overview

### Database Changes
- **New Table: `admin_analytics`**
  - id (INTEGER, PK)
  - metric_name (VARCHAR)
  - metric_value (DECIMAL)
  - date (DATE)
  - period (VARCHAR: 'daily', 'weekly', 'monthly')
- **New Table: `admin_analytics_logs`**
  - id (INTEGER, PK)
  - metric_name (VARCHAR)
  - value (DECIMAL)
  - timestamp (DATETIME)

### Backend APIs
- `GET /api/admin/analytics/dashboard` - Dashboard metrics
- `GET /api/admin/analytics/revenue` - Revenue data
- `GET /api/admin/analytics/user-growth` - User acquisition data
- `GET /api/admin/analytics/project-stats` - Project statistics
- `GET /api/admin/analytics/export` - Export analytics CSV

### Frontend Pages
- `/admin/analytics/page.tsx` - Analytics dashboard
- Interactive charts for metrics
- Date range filters

### Security Considerations
- Admin-only access
- Data aggregation (not exposing individual user data)
- Rate limiting on export endpoints
- Secure CSV generation

### Estimated Effort: 3 days

---

## Implementation Timeline

| Week | Tasks | Estimated Days |
|------|-------|----------------|
| 1 | Database migrations, User role system | 2 days |
| 2 | Admin dashboard, User management | 3 days |
| 3 | Project management, Stripe sync | 3 days |
| 4 | Usage limits, Analytics, Testing | 4 days |
| **Total** | | **12 days** |

---

## Dependencies

1. Phase 1 must be complete (authentication, basic user system)
2. Stripe account configured with webhook access
3. Database backup before migrations
4. Admin user account creation script

---

## Risk Considerations

1. **Database migration complexity** - Test migrations in staging first
2. **Stripe webhook timing** - Handle events arriving out of order
3. **Performance impact** - Admin queries may need optimization
4. **Security** - Multiple layers of access control required

---

## Notes

- All admin actions must be logged for audit trail
- Consider implementing soft deletes for compliance
- Analytics should aggregate data to prevent performance issues
- Consider caching for admin dashboard statistics