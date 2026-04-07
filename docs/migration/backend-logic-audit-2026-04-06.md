# Backend Logic Audit - 2026-04-06

## Scope

Audit and hardening pass for:

1. bin import logic
2. users import and role preservation
3. SAP item import pagination beyond 1000 rows/page
4. large payload insert safety
5. direct backend imports from configured `PA_BINS_URL` and `PA_USERS_URL`
6. strict-role backend enforcement on warehouse count submission

## Findings and Actions

### 1) SAP item import could stop at one upstream response

- **Risk**: When upstream limits payloads (for example 1000 rows), only the first page could be imported.
- **Fix**:
  - `POST /api/sessions/:sessionId/items/import-from-sap` now supports paged upstream fetch.
  - Sends paging hints on each request: `limit`, `offset`, `page`.
  - Supports response array shapes (`items`, `data`, `rows`, `results`) and pagination hints (`hasMore`, `nextOffset`).
  - Adds response telemetry: `pagesFetched`, `received`, `deduped`.
  - Sends both `x-api-key` and `apikey` headers when API key is configured.
- **Config added**:
  - `PA_ITEMS_PAGE_SIZE` (default `1000`)
  - `PA_ITEMS_MAX_PAGES` (default `200`)

### 2) Users import could unintentionally remove privileged access

- **Risk**:
  - Existing Admin/Super Admin users could lose elevated role if IDs/emails shift in upstream feed.
  - Duplicate payload rows could trigger insert conflicts.
- **Fix**:
  - Preserve privileged role by **ID and email** during mapping.
  - Deduplicate imported users by ID/email.
  - Keep privileged users not present in current payload to avoid lockout.
  - Insert in chunks (500 rows) to reduce request-size risk.

### 3) Bin and item imports at scale

- **Fix**:
  - Bin upserts chunked (500 rows).
  - Item imports deduplicated by stable item ID before insert.
  - Item inserts remain chunked (500 rows).

### 4) Missing direct backend import APIs for bins/users

- **Risk**: `PA_BINS_URL` and `PA_USERS_URL` were configured but there were no direct admin endpoints to consume them, so imports depended on webhook payload pushes only.
- **Fix**:
  - Added `POST /api/bins/import-from-pa` (admin/super-admin).
  - Added `POST /api/users/import-from-pa` (admin/super-admin).
  - Both support payload fallback (`data`) and upstream fetch when payload is omitted.
  - Both send API key headers (`x-api-key`, `apikey`) when configured.

### 5) Strict role mode not enforced in backend count submission

- **Risk**: strict-role workflow existed in UI/session controls but `POST /api/warehouse/counts` could still accept checker submissions.
- **Fix**:
  - Warehouse submit now resolves canonical user identity from auth email + users table.
  - In strict mode (`session.strictRoles=true`) and user role `User`:
    - checker is blocked from submitting count
    - non-assigned user is blocked
    - assigned counter/counter2 is allowed
  - Audit `submittedBy` is normalized to directory name when available.

### 6) Users import reset safety and legacy parity

- **Risk**:
  - Calling users import with `resetSessionAssignments=true` but without `sessionId` can silently skip reset intent.
  - UI behavior could drift from legacy flow if reset is not explicitly requested.
- **Fix**:
  - Added schema-level validation: `sessionId` is required when `resetSessionAssignments=true`.
  - Added controller guard with the same rule for defense in depth.
  - Updated React `Import users` button to mirror legacy behavior:
    - destructive confirmation prompt
    - always sends `resetSessionAssignments=true` with current `sessionId`
    - feedback banner includes reset summary

### 7) Approval replay + atomicity hardening

- **Risk**:
  - Re-approving the same adjustment could re-apply quantity delta more than once.
  - Non-transactional update flow could leave partial state if one step fails.
- **Fix**:
  - Service-level guard now blocks reviewing approvals that are no longer `Pending`.
  - Repository fallback path now updates adjustment only when `status='Pending'` and returns conflict on replay.
  - Added Supabase transactional RPC migration: `supabase/migrations/20260406_approval_atomic_rpc.sql`:
    - locks adjustment row
    - enforces one-time review
    - applies item update + audit insert in one DB transaction
  - API now prefers RPC path for approval actions and falls back only when function is not yet deployed.

### 8) Session assignment reset table-name parity fix

- **Risk**:
  - Session reset was pointing to `attendance` table while the app uses `session_attendees`.
- **Fix**:
  - Updated reset counts/deletes to use `session_attendees` consistently.

### 9) Direct PA bin/user imports now support paged upstream fetch

- **Risk**:
  - Bin/user direct imports (`/api/bins/import-from-pa`, `/api/users/import-from-pa`) previously consumed only one upstream response.
  - If upstream payloads are capped per request, records beyond the first page could be skipped.
- **Fix**:
  - Added shared paged fetch loop for direct upstream imports with `limit`, `offset`, and `page` hints on each request.
  - Reused pagination heuristics already proven in SAP item import (`hasMore`, `nextOffset`, row-count fallback).
  - Added per-domain env controls for page size and safety cap.
  - Added response telemetry for direct imports: `pagesFetched` and `received`.
- **Config added**:
  - `PA_BINS_PAGE_SIZE` (default `1000`)
  - `PA_BINS_MAX_PAGES` (default `200`)
  - `PA_USERS_PAGE_SIZE` (default `1000`)
  - `PA_USERS_MAX_PAGES` (default `200`)

## Files Updated

1. `apps/api/src/controllers/admin.controller.ts`
2. `apps/api/src/repositories/supabase-sta-repository.ts`
3. `apps/api/src/repositories/memory-sta-repository.ts`
4. `apps/api/src/validation/schemas.ts`
5. `apps/api/src/config/env.ts`
6. `apps/api/.env.example`
7. `apps/api/tests/section2.routes.test.ts`
8. `apps/api/src/routes/admin.route.ts`
9. `apps/api/src/controllers/warehouse.controller.ts`
10. `apps/api/src/services/sta-service.ts`
11. `apps/api/src/repositories/sta-repository.ts`
12. `apps/api/src/domain/types.ts`
13. `apps/api/tests/section3.strict-auth.test.ts`
14. `docs/api-contracts.md`

## Tests Added

1. bin import deduplication
2. users import privileged-role preservation
3. SAP paged import across 1000+ rows with API key header verification
4. bins import via `PA_BINS_URL`
5. users import via `PA_USERS_URL` with session assignment reset
6. strict-role backend submission enforcement (checker blocked, counter allowed)
7. users import reset request validation (requires `sessionId` when reset requested)
8. approval replay protection (second review returns conflict)
9. bins direct import paged fetch across multiple upstream pages
10. users direct import paged fetch across multiple upstream pages

## Validation Run

1. `npm run test:api` passed (`30` tests).
2. `npm run typecheck:api` passed.
3. `npm run lint:api` passed.
