# Local Cutover Runbook

## 1) Prepare Environment Files

Create `apps/api/.env` from `apps/api/.env.example` and set:

- `DATA_SOURCE=supabase`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- optional: `WEBHOOK_SHARED_SECRET`
- optional paging controls for upstream imports:
  - `PA_BINS_PAGE_SIZE`, `PA_BINS_MAX_PAGES`
  - `PA_USERS_PAGE_SIZE`, `PA_USERS_MAX_PAGES`
  - `PA_ITEMS_PAGE_SIZE`, `PA_ITEMS_MAX_PAGES`

Create `apps/web/.env` from `apps/web/.env.example` and set:

- `VITE_API_BASE_URL=http://localhost:4001/api`

## 2) Apply Database Hardening Migration

Run the SQL in:

- `supabase/migrations/20260405_section3_hardening.sql`
- `supabase/migrations/20260406_approval_atomic_rpc.sql`

This migration:

1. adds performance indexes
2. removes direct client write policies
3. keeps authenticated read policies
4. revokes insert/update/delete grants for anon/authenticated roles
5. makes approval review atomic (single transactional RPC)

## 3) Start Services

From repo root:

```powershell
npm run dev
```

Expected:

- web: `http://localhost:5174`
- api: `http://localhost:4001`

## 4) Smoke Tests

1. `GET /api/health` returns `status: ok`
2. Admin page can list sessions via API
3. Create session works
4. Warehouse submit count works
5. Webhook import endpoint accepts valid payload

## 5) Regression Suite

```powershell
npm run typecheck
npm run lint
npm run test:legacy
npm run test:web
npm run test:api
```

## 6) Rollback Path

If Supabase is unavailable during local testing:

1. set `DATA_SOURCE=memory` in `apps/api/.env`
2. restart API

Note: memory mode is non-persistent and for temporary fallback only.
