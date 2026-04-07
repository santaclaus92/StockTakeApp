# Detailed Refactor Plan (Codex + Claude Execution Spec)

## 1) Top Instructions (Mandatory)

1. Work only in: `C:\Users\albert.s.BMGRP\OneDrive - Biomed Global Services Sdn Bhd\Documents\refactored STA`
2. Do not modify the old app in: `...\Documents\Playground`
3. Execute phases sequentially (Section 0 -> 1 -> 2 -> 3)
4. Stop and ask for approval after each major section
5. Ask for confirmation whenever there is any hesitation or ambiguity
6. Every code change must include tests
7. Never commit `.env` files and never hardcode credentials

---

## 2) Migration Goal

Refactor current Vite + vanilla JS app into:

1. `React + TypeScript` frontend
2. `Node.js (Express + TypeScript)` backend
3. Supabase remains the database/auth provider
4. Backend-only write model (no direct client writes to Supabase)
5. App must continue running on localhost during migration

---

## 3) Delivery Rules

1. No big-bang rewrite. Use strangler approach.
2. Keep existing behavior parity while migrating module by module.
3. One feature/domain per PR.
4. Include rollback notes in each PR.
5. Update docs and parity checklist per merged change.

---

## 4) Target Architecture

1. `apps/web`: React + Vite + TypeScript
2. `apps/api`: Express + TypeScript
3. `packages/shared`: shared Zod schemas, DTOs, contracts
4. `supabase/migrations`: SQL migrations for policy/schema updates
5. `docs/migration`: parity checklist, phase notes, cutover runbook

---

## 5) Major Section 0 - Foundation Setup

### 0.1 Repository and Tooling

1. Create folder structure:
   - `apps/web`
   - `apps/api`
   - `packages/shared`
   - `docs/migration`
2. Configure TypeScript for web and api.
3. Add root scripts:
   - `dev:web`
   - `dev:api`
   - `dev`
   - `test:web`
   - `test:api`
   - `test:e2e`
   - `test:all`
4. Set Vite proxy: `/api` -> `http://localhost:4001`
5. Add lint + typecheck + test scripts.

### 0.2 Security and Env

1. Create `apps/web/.env.example` (public variables only).
2. Create `apps/api/.env.example` (service role + webhook secrets).
3. Add env validation on API startup.
4. Ensure service role key is never exposed to frontend.

### 0.3 Baseline and Test Safety Net

1. Create `docs/migration/parity-checklist.md` for current flows.
2. Add API health endpoint `GET /api/health`.
3. Add health test (api) and app boot smoke test (web).
4. Ensure existing regression tests still run.

### 0.4 Section 0 Exit Criteria

1. New skeleton runs locally.
2. Tests pass.
3. Parity checklist committed.

### 0.5 Approval Gate

Ask user: "Section 0 completed. Approve Section 1 (React UI migration)?"

---

## 6) Major Section 1 - React UI Migration (Module by Module)

### 1.0 UI Engineering Rules

1. Build with React Router + TanStack Query + React Hook Form + Zod.
2. No direct Supabase write calls inside components.
3. Use service layer/hooks (`apps/web/src/services/*`, `apps/web/src/hooks/*`).
4. Keep temporary feature flags for safe rollout.
5. Match behavior and UX of existing app.

### 1.1 Admin View Migration Sequence

1. Admin homepage
2. New session modal
3. Session header
4. Session tab: Pair assignment
5. Session tab: Attendance
6. Session tab: Stock count list / item master
7. Session tab: Dashboard
8. Session tab: Audit trail
9. Session tab: New item gallery
10. Session tab: Approval

### 1.2 Warehouse View Migration Sequence

1. Warehouse homepage
2. Gallery of searched items and assigned items
3. Count input form

### 1.3 Testing Requirements Per Module

1. Component/unit tests for UI state and validation
2. Data hook tests for query/mutation behavior
3. At least one Playwright path per migrated critical module

### 1.4 Section 1 Exit Criteria

1. All listed modules are implemented in React.
2. Critical admin + warehouse flows pass E2E.
3. Behavior matches parity checklist.

### 1.5 Approval Gate

Ask user: "Section 1 completed. Approve Section 2 (Express backend migration)?"

---

## 7) Major Section 2 - Express Backend Migration (Backend-only Writes)

### 2.0 Backend Core Setup

1. Implement layered architecture:
   - `routes`
   - `controllers`
   - `services`
   - `repositories`
2. Add shared validation middleware using Zod schemas from `packages/shared`.
3. Add Supabase JWT verification middleware.
4. Add role guard middleware for `User`, `Admin`, `Super Admin`.
5. Use Supabase service-role client only in API process.
6. Add centralized error handling and structured logs.

### 2.1 Domain Migration Sequence

1. Import bin locations via webhook
2. Import users via webhook
3. Import items via webhook
4. Pair assignment using imported users
5. Read/write attendance
6. CRUD stock count list
7. CRUD audit trail
8. CRUD new item bucket and detail
9. Approval logic for edited quantity

### 2.2 Endpoint Contract Targets

1. `POST /api/webhooks/bins/import`
2. `POST /api/webhooks/users/import`
3. `POST /api/webhooks/items/import`
4. `GET/POST/PUT/DELETE /api/pairs`
5. `GET/POST/PUT /api/attendance`
6. `GET/POST/PUT/DELETE /api/items`
7. `GET/POST /api/audit`
8. `GET/POST/PUT /api/new-items`
9. `POST /api/approvals/:id/approve`
10. `POST /api/approvals/:id/reject`

### 2.3 Critical Transaction Rule (Approval)

Approval/rejection of edited quantity must be atomic:

1. Update adjustment status
2. Update item quantity/bin/status as required
3. Insert audit record
4. Roll back whole operation on failure

Prefer SQL function/RPC transaction if needed.

### 2.4 Frontend Cutover Rules

1. Replace direct frontend writes with API calls domain-by-domain.
2. Remove any direct client write paths once domain is migrated.
3. Keep read strategy explicit (prefer API for consistency).

### 2.5 Section 2 Exit Criteria

1. All writes go through Express API.
2. Service role key is server-side only.
3. API integration tests pass.
4. Critical E2E flows pass via API.

### 2.6 Approval Gate

Ask user: "Section 2 completed. Approve Section 3 (hardening and cutover)?"

---

## 8) Major Section 3 - Supabase Hardening, Cleanup, and Cutover

### 3.1 Supabase Hardening

1. Add/update SQL migrations for schema and policy changes.
2. Restrict direct client write policies.
3. Keep only required read permissions.
4. Add indexes for high-volume filters and approval queue.

### 3.2 Security + Reliability

1. Add request correlation IDs and structured logs.
2. Add webhook auth + rate limiting + idempotency guards.
3. Add robust error mapping for UI-safe responses.

### 3.3 Cleanup

1. Remove legacy vanilla paths in refactored app.
2. Remove temporary migration flags after stabilization.
3. Finalize docs:
   - architecture
   - API contracts
   - runbooks

### 3.4 Final Verification

1. Run full test suite (`test:all`).
2. Execute complete parity checklist.
3. Validate localhost startup and critical workflows.

### 3.5 Section 3 Exit Criteria

1. React + Express architecture fully active.
2. Legacy migration code removed in refactored app.
3. Stable candidate ready for release.

### 3.6 Approval Gate

Ask user for final release approval.

---

## 9) Task Execution Protocol for Codex/Claude

1. Before each task, restate scope and impacted files.
2. Implement one ticket/domain per PR.
3. Run tests before marking task done.
4. Report:
   - changed files
   - test results
   - risk and rollback note
   - updated docs
5. Pause at each major approval gate.

---

## 10) Suggested Ticket IDs

1. `FND-001` to `FND-010`: Section 0 foundation
2. `UI-001` to `UI-013`: Section 1 UI modules
3. `API-001` to `API-020`: Section 2 backend domains
4. `CUT-001` to `CUT-008`: Section 3 hardening/cutover

Use one ticket per PR with clear acceptance criteria and tests.

---

## 11) Execution Log (Progress Notes)

### 2026-04-06 - UI/API Parity Batch (Attendance + Item Master + Scan & Count)

1. Attendance tab parity:
   - Replaced fallback token text with generated scannable QR image.
   - Attendance card now supports and displays 4 time slots:
     - check in
     - lunch out
     - lunch in
     - check out
   - Added save support for all 4 timestamps via API.

2. Item Master parity:
   - Warehouse filter now uses `wh_code` (warehouse code), not bin location.
   - Added recount parent-session context to show first-count columns:
     - `p1bin`
     - `p1by`
     - `p1cnt`
   - Added draggable column order and column resize handles.
   - Kept header/toolbars fixed to layout while table content remains horizontally scrollable.

3. Scan & Count parity:
   - Removed manual assigned-pair selector from warehouse UI.
   - Assigned-items query now uses user identity context + session, following legacy auto-assignment flow.
   - Added mobile layout trigger integration with bottom navigation.
   - Count History now filters by `session` and defaults from `stp_count_sess` selection memory.

4. Backend/API parity:
   - Attendance schema/domain/repositories now support:
     - `check_in`, `lunch_out`, `lunch_in`, `check_out`
   - Attendance scan endpoint now supports slot progression and returns `slot`:
     - `check_in` -> `lunch_out` -> `lunch_in` -> `check_out`
   - Count History API now supports `sessionId` filter.
   - Assigned items API now supports user-context filtering (`assignee`/`userName`) for legacy-style assignment behavior.

5. Validation:
   - `apps/web`: typecheck pass, lint pass, tests pass (34/34).
   - `apps/api`: typecheck pass, lint pass, tests pass (35/35).

### 2026-04-06 - Item Master Warehouse-Code Ingestion Hardening

1. Import payload compatibility widened for warehouse code and bin keys:
   - `wh_code`, `whCode`, `warehouse_code`, `warehouseCode`, `wh`, `warehouse_id`
   - `item_location`, `itemLocation`, `bin_location`, `binLocation`, `warehouse`, `location`
2. Applied in both repositories to keep runtime behavior consistent:
   - `apps/api/src/repositories/supabase-sta-repository.ts`
   - `apps/api/src/repositories/memory-sta-repository.ts`
3. Import dedupe key now includes normalized location + warehouse code variants:
   - `apps/api/src/controllers/admin.controller.ts`
4. Regression test added:
   - `apps/api/tests/section2.routes.test.ts`
   - verifies mixed-key SAP payload maps correctly to:
     - `warehouse` (bin location)
     - `whCode` (warehouse code)

### 2026-04-06 - Legacy UI Parity Fix Batch (Sidebar, Pair Assignment, Item Master, Dashboard, New Item Gallery)

1. Sidebar session child label:
   - Fixed left sidebar so opened session appears as a child under `Sessions` (not generic `Session`).
   - Added route-based session child rendering with session-name lookup and session-id fallback.
   - Cleaned child marker rendering to plain ASCII.

2. Pair Assignment behavior parity:
   - Pair Assignment tab now auto-runs bin import on tab/session entry.
   - Pair edit opens modal popup (legacy-like modal workflow) instead of inline card form.
   - Replaced name entry combobox/datalist flow with full dropdown selects for:
     - `Counter`
     - `Checker`
     - `Counter 2`
   - Dropdown options remain full user list and do not filter by typed search text.

3. Item Master layout parity:
   - Kept `tab-header-row`, `status-strip`, and `item-master-toolbar` constrained to viewport width.
   - Restricted horizontal scroll to `item-master-table-wrap` only.
   - Enabled table header text wrapping for narrow column widths.

4. Dashboard warehouse grouping parity:
   - `By Warehouse` aggregation now groups by `wh_code` first (fallback to bin only when missing).
   - Applied consistently across API repositories and mock store for parity in local/test runs.
   - Dashboard drilldown filtering and displayed warehouse column now use warehouse-code-first logic.

5. New Item Gallery parity:
   - Removed approve/reject workflow from gallery.
   - Gallery now displays submitted items and details without approval action controls.

6. Validation:
   - `apps/web`: tests pass (37/37).
   - `apps/api`: tests pass (35/35).

### 2026-04-06 - Legacy UI Detail Parity (Item Master + Attendance)

1. Item Master column width parity:
   - Default column widths now use character-count sizing from header labels to keep headers on one line by default.
   - This preserves previous behavior where headers can still wrap if user manually narrows columns.

2. Item Master per-user layout persistence:
   - Column order and resized widths are now saved to `sessionStorage`.
   - Storage is scoped by:
     - user identity (`sta_identity.id`, fallback to email/anon)
     - session ID
   - On browser refresh, users see their own last column order and widths.

3. Item Master column menu layering:
   - Raised toolbar/column-menu stacking and removed clipping so `Columns` menu appears above table (not behind it).

4. Attendance timing layout parity:
   - Each attendance card now shows the 4 timing slots in a single horizontal row (4 cells):
     - Check In
     - Lunch Out
     - Lunch In
     - Check Out

5. Attendance QR parity:
   - Attendance QR now auto-regenerates every 60 seconds without requiring manual button click.
   - Manual `Regenerate QR` remains available.

6. Validation:
   - `apps/web`: tests pass (41/41)
   - `apps/web`: lint pass
   - `apps/web`: typecheck pass

### 2026-04-06 - Attendance Multi-Session Scan + TV Dashboard Attendance/QR Parity

1. Attendance scan propagation by country and date:
   - Updated backend scan logic so one QR scan writes attendance to all sessions that match:
     - same `startDate` as scanned session
     - same country as scanned user (`users.country`, fallback to scanned session country)
     - session is not `Closed`
   - Slot progression (`check_in` -> `lunch_out` -> `lunch_in` -> `check_out`) is applied per target session independently.
   - Scan API response now includes `affectedSessionIds` for client-side refresh.

2. User country surfaced in API user model:
   - Added optional `country` to `UserRoleRecord` in API/web domain types.
   - Repositories now select/map `users.country` in:
     - `listUsers`
     - `findUserByEmail`
     - `updateUserRole`
   - In-memory seed/import mappings updated for country support.

3. TV dashboard attendance parity:
   - Replaced token-only display with QR generation matching Attendance tab behavior.
   - QR auto-refreshes every 60s with countdown.
   - QR is clickable and opens enlarged lightbox (80% viewport width).
   - Attendance panel now renders by pair:
     - each pair shown as a card
     - each member has status dot (green present / red absent)
     - each member line shows all 4 timing slots on one line
   - Pair cards sorted by latest attendance event timestamp.

4. CSS cleanup:
   - Removed obsolete attendance value selectors no longer used by current UI (`.att-time-val*`).
   - Added TV QR/lightbox and pair-attendance styles.

5. Client cache refresh support:
   - Attendance scan mutation now invalidates attendance queries for all `affectedSessionIds` returned by API.

6. Validation:
   - `apps/api`: `npm --prefix apps/api run test -- tests/section2.routes.test.ts` pass (20/20)
   - `apps/web`: `npm --prefix apps/web run test -- src/pages/AdminSessionPage.test.tsx` pass (13/13)
   - `apps/web`: lint pass
   - `apps/api`: lint pass
