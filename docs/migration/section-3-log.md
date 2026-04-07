# Section 3 Implementation Log

## Layman Summary

Section 3 focuses on production hardening and cutover readiness.

1. Database security was tightened so client roles are read-only; writes are backend-only.
2. API reliability was improved with structured request logs and better error mapping.
3. Webhook endpoints now have stronger protection: shared secret, rate limiting, and idempotency replay.
4. Final docs were added for architecture, API contracts, and local cutover runbook.

## Technical Notes

### Supabase hardening migration

Added SQL migration:

- `supabase/migrations/20260405_section3_hardening.sql`

What it does:

1. Adds high-value indexes for items, audit, and approval queue lookups.
2. Enables RLS on core tables.
3. Drops broad client write policies from earlier phases.
4. Creates authenticated read-only policies.
5. Revokes insert/update/delete grants for anon/authenticated roles.

### API hardening

Added middleware and wiring:

- `request-logger.ts`: structured JSON logs with request ID and latency
- `webhook-rate-limit.ts`: per-IP and per-path request throttling
- `webhook-idempotency.ts`: replay-safe webhook handling by `idempotency-key`
- `error-mapper.ts`: maps DB/network failures into safer HTTP responses

Updated API startup/app config to include:

- webhook rate-limit window/max env controls
- webhook idempotency TTL env control
- strict `DATA_SOURCE=supabase` env validation

### Documentation finalized

- `docs/architecture.md`
- `docs/api-contracts.md`
- `docs/runbook-local-cutover.md`

## Tests Added

New section 3 API tests:

- `apps/api/tests/section3.hardening.test.ts`
  - webhook shared-secret enforcement
  - webhook rate limiting
  - webhook idempotency replay
  - duplicate-key DB error mapping to HTTP 409

- `apps/api/tests/section3.strict-auth.test.ts`
  - auth-required mode blocks unauthenticated requests
  - valid admin bearer token can access admin routes
  - user role is denied for admin-only write routes

Updated E2E smoke compatibility test:

- `tests/e2e/smoke.test.js`
  - supports both legacy (`MediCount`) and refactored React branding/selectors
  - keeps authenticated checks gated behind `test:e2e:setup`

## Validation Results

- `npm run typecheck:api`: passed
- `npm run lint:api`: passed
- `npm run test:api`: passed (3 files, 10 tests)
- `npm run typecheck:web`: passed
- `npm run lint:web`: passed
- `npm run test:web`: passed (4 files, 4 tests)
- `npm run test:legacy`: passed (6 files, 79 tests)
- `npm run test:e2e`: passed (4 passed, 4 skipped pending auth setup)
- `npm run test:all`: passed

Authenticated OTP setup run status:

- `npm run test:e2e:setup`: requires manual OTP interaction in headed browser; not auto-completable in this non-interactive run environment.

## Remaining Notes

1. `Supabase auth/session still functional` in parity checklist remains pending for explicit end-user login flow validation.
2. `Warehouse count history view` remains pending in parity checklist as a separate UI feature.

## 2026-04-06 Hardening Addendum

1. Approval replay is now blocked at service and repository level (`Pending` status required).
2. Added Supabase transactional RPC migration for approval review:
   - `supabase/migrations/20260406_approval_atomic_rpc.sql`
3. Supabase repository reset flow now uses `session_attendees` consistently (not `attendance`).
4. Direct PA imports for bins/users now support paged upstream fetch with env-configurable page size/max pages and return `pagesFetched` telemetry.
