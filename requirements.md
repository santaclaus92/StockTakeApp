# StockTake Pro — Requirements & Fix Backlog

> Generated: 2026-03-26 from senior code review.  
> Updated: 2026-03-26 — Phase 1 implemented.
> Use this as your implementation checklist. Mark items `[x]` when done.

---

## Phase 1 — Security Hardening 🔴🟠

### 1.1 Enable Row Level Security (RLS) on All Tables
**File:** `data/schema.sql`  
**Risk:** Anyone with the Supabase anon key can read/write all data.

- [x] Enable RLS on `sessions`, `pairs`, `items`, `count_adjustments`, `item_audit`, `warehouses`, `session_attendees`, `users`
- [x] Add SELECT/INSERT/UPDATE policies for `anon` role
- [x] Long-term: scope write policies by `auth.jwt() ->> 'role'`

> ⚠️ **Action required:** Run the new bottom section of `data/schema.sql` in **Supabase Dashboard → SQL Editor**.

```sql
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_sessions" ON sessions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_sessions" ON sessions FOR ALL TO anon USING (true) WITH CHECK (true);
-- Repeat for pairs, items, count_adjustments, item_audit
```

---

### 1.2 Role via Supabase Auth JWT Metadata ✅
**File:** `index.html`, `data/schema.sql`  
**Risk:** `ssoUserRole` is stored in `sessionStorage` — trivially spoofed in DevTools.  
**Approach:** Use `auth.users.raw_app_meta_data` → role is embedded in the JWT, readable via `sb.auth.getUser()`. Implemented securely via backend RPC.

- [x] JWT role integrated into `verifyOtp()`, `requireAdmin()`, and app initialization.
- [x] Removed all insecure `sessionStorage.setItem(SSO_ROLE_KEY, ...)` logic.
- [x] Added `set_user_role` secure RPC function to `schema.sql`.
- [x] Added "Users & Roles" Admin modal in the frontend to seamlessly promote users.

---

### 1.3 Fix CORS on `server.js` ✅
**File:** `server.js`  

- [x] `setCors` now reads `ALLOWED_ORIGINS` from env and only echoes back trusted origins
- [x] `ALLOWED_ORIGINS` added to `.env.example`

> ⚠️ **Action required:** Add your deployed frontend URL to `ALLOWED_ORIGINS` in your `.env` file.

---

### 1.4 Add Authentication to `server.js` ✅
**File:** `server.js`  

- [x] `API_KEY` env var read at startup
- [x] Requests missing or mismatching `X-Api-Key` header rejected with `401`
- [x] `API_KEY` added to `.env.example`

> ⚠️ **Action required:** Set `API_KEY=<random string>` in your `.env` file to activate.

---

### 1.5 Add OTP Cooldown Timer ✅
**File:** `index.html` — `sendOtp()`  

- [x] Button locked for 60 seconds after successful OTP send
- [x] Button text counts down: "Resend in 58s" → "Resend in 57s" → …

---

### 1.6 Fix XSS — Sanitize innerHTML with User/Scanner Input ✅
**File:** `index.html` — `processMultiScan()`  

- [x] "Not found" entry: `code` (raw scanner value) now set via `textContent` + `addEventListener`
- [x] "Found" entry: `batchDisplay`, `match.code`, `match.name` set via `textContent`
- [x] Removed unsafe `onclick` string concatenation — replaced with proper event listener

---

## Phase 2 — Architecture & Code Quality 🟠🟡

### 2.1 Split Monolithic HTML into Modules
**File:** `index.html` (5,583 lines / 306 KB)  
**Issue:** Entire app (HTML + CSS + JS) in one file. Unmaintainable at scale.

- [ ] Set up Vite as build tool (`npm create vite@latest`)
- [ ] Extract CSS to `src/styles/index.css`
- [ ] Split JS into modules:
  - `src/supabase.js` — Supabase client singleton
  - `src/auth.js` — OTP login / logout / role
  - `src/sessions.js` — session CRUD
  - `src/count.js` — counting workflow
  - `src/audit.js` — audit trail
  - `src/admin.js` — admin panel logic
  - `src/utils.js` — shared helpers

---

### 2.2 Add Supabase Query Pagination
**File:** `index.html` — all `sb.from(...).select('*')` calls  
**Issue:** Full table scans. A session with 10,000 items downloads everything at once.

- [ ] Add `.range(from, to)` to all list queries
- [ ] Implement "Load more" button or virtual scroll for Item Master table
- [ ] Use column projection — only select columns that are rendered:

```javascript
// Before:
sb.from('items').select('*').eq('session_id', id)

// After:
sb.from('items')
  .select('id, code, name, count_qty, sap_qty, item_status, bin_location, batch, uom, new_item')
  .eq('session_id', id)
  .range(0, 499)
```

---

### 2.3 Fix Schema Migrations — Make Idempotent
**File:** `data/schema.sql`  
**Issue:** `RENAME COLUMN` statements fail if run on a fresh database or re-run.

- [ ] Wrap rename statements in `DO $$ BEGIN ... EXCEPTION WHEN undefined_column THEN NULL; END $$;`
- [ ] Or migrate to Supabase CLI with versioned migration files (`supabase/migrations/`)

```sql
DO $$ BEGIN
  ALTER TABLE items RENAME COLUMN bin TO warehouse;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;
```

---

### 2.4 Replace `var` with `const`/`let`
**File:** `index.html` — entire JS section  
**Issue:** `var` has function-scoped hoisting that causes subtle bugs in loops and async.

- [ ] Do a progressive replacement — convert to `const`/`let` as each function is touched
- [ ] At minimum, fix all `var` inside loop bodies

---

### 2.5 Define Constants for Magic Strings
**File:** `index.html`  
**Issue:** Status strings like `'Active'`, `'Pending'`, `'Approved'`, `'Year End'` are scattered across hundreds of lines.

- [ ] Create a `CONST.js` or top-of-script constants block:

```javascript
const STATUS = Object.freeze({ ACTIVE: 'Active', DRAFT: 'Draft', CLOSED: 'Closed' });
const SESSION_TYPE = Object.freeze({ YEAR_END: 'Year End', CYCLE_COUNT: 'Cycle Count' });
const ADJ_STATUS = Object.freeze({ PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' });
const ITEM_STATUS = Object.freeze({ MATCHED: 'Matched', VARIANCE: 'Variance', UNCOUNTED: 'Uncounted' });
```

---

### 2.6 Centralise Error Handling for Supabase Calls
**File:** `index.html`  
**Issue:** Error handling is inconsistent; many failures silently swallow errors.

- [ ] Add a shared helper:

```javascript
async function sbQuery(promise, label) {
  const res = await promise;
  if (res.error) {
    console.error(`[${label}]`, res.error);
    throw res.error;
  }
  return res.data;
}
```

- [ ] Wrap all Supabase calls in try/catch with user-visible error messages

---

### 2.7 Add Automated Tests
**File:** `package.json`, new `tests/` directory  
**Issue:** `"test": "echo \"Error: no test specified\""` — zero test coverage.

- [ ] Install Vitest: `npm install -D vitest`
- [ ] Write unit tests for server.js CRUD logic
- [ ] Write tests for utility functions (variance calculation, OTP flow)

---

## Phase 3 — Missing Features 🟢

| # | Feature | Priority | Description |
|---|---|---|---|
| 3.1 | **Offline / PWA Mode** | High | Cache session items in IndexedDB. Show offline banner. Sync on reconnect. |
| 3.2 | **Export to Excel/CSV** | High | Export Item Master and Audit Trail from session detail. Use SheetJS. |
| 3.3 | **Variance Threshold Alerts** | High | Auto-flag items where `abs(count - sap) / sap > threshold%`. Configurable per session. |
| 3.4 | **Real-time Session Dashboard** | Medium | Show per-pair and per-warehouse completion % with live updates via Supabase Realtime. |
| 3.5 | **Duplicate Count Detection** | Medium | Warn admin when same item code is submitted by 2+ pairs in the same session. |
| 3.6 | **Supervisor Sign-off** | Medium | Before closing a session, require supervisor to digitally confirm each pair's submission. |
| 3.7 | **Barcode Label Generator** | Medium | Generate printable QR/barcode labels from item codes inside the app. |
| 3.8 | **Auto Email Report on Close** | Low | Send session summary email to admins when a session is closed. |
| 3.9 | **Dark Mode** | Low | Toggle in user menu. Persist to localStorage. |

---

## Notes

- Supabase anon key is intentionally public (it's in the browser bundle). RLS is what prevents misuse — that's why fix 1.1 is critical.
- `server.js` is a local development tool, not the production backend (Supabase is). Still worth securing it (1.3, 1.4) if it runs on any shared network.
- `otp_tokens` table already has correct RLS (service-role only). Don't change it.
- `session_deletions` insert-only RLS is correct — keep it.
