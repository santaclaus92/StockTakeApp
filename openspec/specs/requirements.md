# StockTake Pro — System Requirements

> Derived from codebase analysis (index.html, server.js, schema.sql, README.md, design_guide.md)
> Last updated: 2026-03-25

---

## 1. Overview

**StockTake Pro** is a mobile-first, single-page web application for managing physical inventory stock-taking operations. It supports year-end counts and cycle counts across multiple warehouse locations, with full integration to SAP (via Power Automate) and Azure AD (for user management).

### Primary Users

| Role | Description |
|------|-------------|
| Admin | Creates sessions, manages pairs, imports data, oversees progress |
| Counter | Mobile user who scans items and records counts |
| Checker | Mobile user who verifies counts alongside the counter |

### Deployment

- Frontend: Vercel
- Database & Auth: Supabase (PostgreSQL + Edge Functions)
- External: Power Automate (SAP/Azure AD), Microsoft Office365 (SMTP)

---

## 2. Functional Requirements

### FR-1: Authentication & Authorization

| ID | Requirement |
|----|-------------|
| FR-1.1 | System SHALL support Admin PIN login (4-digit PIN, max 5 attempts before lockout) |
| FR-1.2 | System SHALL support SSO via Email OTP (Supabase Auth + Office365 SMTP) |
| FR-1.3 | System SHALL enforce role-based access: Admin sees all; Users see only their assigned sessions |
| FR-1.4 | OTP codes SHALL expire after a configurable time window |
| FR-1.5 | Failed PIN attempts SHALL be counted and the account locked after 5 failures |

---

### FR-2: Session Management

| ID | Requirement |
|----|-------------|
| FR-2.1 | Admin SHALL be able to create, edit, and delete stock-taking sessions |
| FR-2.2 | Sessions SHALL have a type: **Year End** or **Cycle Count** |
| FR-2.3 | Sessions SHALL follow a lifecycle: **Draft → Active → Closed** |
| FR-2.4 | Admin SHALL be able to toggle session visibility (show/hide from Users) |
| FR-2.5 | Session progress (0–100%) SHALL be tracked and displayed |
| FR-2.6 | Admin SHALL NOT be able to close a session while unresolved variances exist without creating a recount session |
| FR-2.7 | Sessions SHALL support entity and country fields for multi-entity organizations |

---

### FR-3: Recount Sessions

| ID | Requirement |
|----|-------------|
| FR-3.1 | Admin SHALL be able to create a recount session linked to a parent session |
| FR-3.2 | Variance items from the parent session SHALL flow into the recount session |
| FR-3.3 | New items (not in SAP) from the parent session SHALL also be eligible for recount |
| FR-3.4 | Parent session SHALL be blocked from closing until recount session is created for all variances |
| FR-3.5 | Recount sessions SHALL reference their parent session via `parent_id` |
| FR-3.6 | Recount sessions SHALL be one level deep only — a recount session CANNOT have its own recount |

---

### FR-4: Pair & Attendance Management

| ID | Requirement |
|----|-------------|
| FR-4.1 | Admin SHALL assign counter–checker pairs to a session |
| FR-4.2 | Each pair SHALL be associated with a specific warehouse location |
| FR-4.3 | Attendance SHALL be recordable via QR code scan |
| FR-4.4 | Attendance SHALL be manually addable or removable by Admin |
| FR-4.5 | System SHALL support marking a counter or checker as absent |
| FR-4.6 | Each pair SHALL have an individual progress tracking field |

---

### FR-5: Item Master & Import

| ID | Requirement |
|----|-------------|
| FR-5.1 | Admin SHALL be able to import item master data from SAP via Power Automate webhook |
| FR-5.2 | Admin SHALL be able to import users from Azure AD via Power Automate webhook |
| FR-5.3 | Admin SHALL be able to import warehouse/bin locations from SAP via Power Automate webhook |
| FR-5.4 | Imported items SHALL include: code, name, group, batch, warehouse, SAP qty, entity, WH code |
| FR-5.5 | Items SHALL support soft-delete flags (`is_delete`, `dropped`) |

---

### FR-6: Item Counting

| ID | Requirement |
|----|-------------|
| FR-6.1 | Users SHALL be able to scan item barcodes using the device camera (BarcodeDetector API) |
| FR-6.2 | Users SHALL be able to manually search for items by code or name |
| FR-6.3 | Users SHALL record: count qty, damaged qty, expired qty, remark |
| FR-6.4 | Users SHALL be able to capture and attach photos to items |
| FR-6.5 | System SHALL detect and warn on duplicate scans of the same item within a session |
| FR-6.6 | System SHALL calculate and display variance (SAP qty vs count qty) |
| FR-6.7 | Count quantities SHALL support fractional values (NUMERIC type) |

---

### FR-7: New Item Registration

| ID | Requirement |
|----|-------------|
| FR-7.1 | Users SHALL be able to register items not present in the SAP item master |
| FR-7.2 | New items SHALL be flagged with `new_item = true` |
| FR-7.3 | New items SHALL NOT require an approval flow — they are accepted as-is upon submission |
| FR-7.4 | New items SHALL be eligible to flow into recount sessions |

---

### FR-8: Audit Trail

| ID | Requirement |
|----|-------------|
| FR-8.1 | Every count submission SHALL be logged immutably in `item_audit` |
| FR-8.2 | Audit records SHALL include: item code/name, submitted_by, pair_id, all qty fields, warehouse, remark, timestamp |
| FR-8.3 | Session deletions SHALL be logged immutably in `session_deletions` |
| FR-8.4 | Audit tables SHALL be write-only from the application layer (no UI delete/edit) |

---

### FR-9: Dashboard & Reporting

| ID | Requirement |
|----|-------------|
| FR-9.1 | Dashboard SHALL display counts of: active items, variance items, new items |
| FR-9.2 | Dashboard SHALL display session progress visualization |
| FR-9.3 | System SHALL provide a gallery view for item photos |
| FR-9.4 | Item master SHALL support pagination and filtering |

---

## 3. Non-Functional Requirements

### NFR-1: Design & UX

| ID | Requirement |
|----|-------------|
| NFR-1.1 | UI SHALL follow the "quiet luxury" minimalist aesthetic defined in `design_guide.md` |
| NFR-1.2 | Color palette: Pure White `#FFFFFF`, Off-White `#F9F9F9`, Deep Indigo `#2C3E50` |
| NFR-1.3 | Typography: Inter (Google Fonts), weights 300–400 body, 600 for key data |
| NFR-1.4 | Borders: ultra-thin 0.5px; shadows: soft `0 8px 30px rgba(0,0,0,0.04)` |
| NFR-1.5 | Minimum padding: 24px |

### NFR-2: Mobile

| ID | Requirement |
|----|-------------|
| NFR-2.1 | App SHALL be usable on mobile devices (minimum 720px height) |
| NFR-2.2 | Touch targets SHALL be minimum 48px |
| NFR-2.3 | Navigation SHALL use a bottom bar with glassmorphism styling |
| NFR-2.4 | Border radius for mobile components: 4–8px |

### NFR-3: Security

| ID | Requirement |
|----|-------------|
| NFR-3.1 | No credentials SHALL be hardcoded in source files |
| NFR-3.2 | All secrets SHALL be stored as environment variables |
| NFR-3.3 | `.env` files SHALL NEVER be committed to source control |
| NFR-3.4 | OTP tokens SHALL be stored in the database and expire on a time basis |

### NFR-4: Performance & Reliability

| ID | Requirement |
|----|-------------|
| NFR-4.1 | Database SHALL use Supabase PostgreSQL for production |
| NFR-4.2 | All data changes made through the web app SHALL be reflected in Supabase in real time — no manual refresh required |
| NFR-4.3 | Local development SHALL be supported via Node.js server with JSON file persistence |

### NFR-5: Deployment

| ID | Requirement |
|----|-------------|
| NFR-5.1 | Frontend SHALL be deployable to Vercel |
| NFR-5.2 | Backend logic SHALL run as Supabase Edge Functions (Deno runtime) |
| NFR-5.3 | App SHALL integrate with Power Automate for SAP and Azure AD data sync |

---

## 4. Data Model Summary

```
sessions ──────────────────────────────────┐
  id, name, type, entity, country          │
  status (Draft|Active|Closed)             │
  progress, user_visible                   │
  parent_id ──────────────────────────► (self, for recount)
                                           │
pairs ─────────────────────────────────────┤
  session_id → sessions                    │
  counter_name, checker_name               │
  warehouse_id → warehouses                │
  role, counter_absent, checker_absent     │
                                           │
items ─────────────────────────────────────┤
  id, code, name, group, batch             │
  sap_qty, count_qty, variance             │
  damaged_qty, expired_qty                 │
  photos (JSON[]), new_item                │
  session_id → sessions                    │
                                           │
warehouses                                 │
  id, name, shelves (JSONB)               │
                                           │
users                                      │
  id, name, email, display_name            │
  role (Admin|User)                        │
                                           │
item_audit (immutable)                     │
  → items, sessions, pairs                 │
  counted_at, all qty fields               │
                                           │
session_deletions (immutable)              │
  deleted_by, deleted_at                   │
                                           │
otp_tokens                                 │
  email, code, expires_at                  │
                                           │
session_attendees                          │
  session_id → sessions                    │
  user_id → users                          │
  attended (BOOLEAN)                       │
```

---

## 5. Integration Map

```
┌──────────────┐    webhook    ┌────────────────────┐    HTTP    ┌─────────────────┐
│     SAP      │ ────────────► │  Power Automate    │ ─────────► │  Supabase Edge  │
│  (ERP)       │              │  (Flow/Logic Apps)  │            │  Functions      │
└──────────────┘              └────────────────────┘            │  - import-items │
                                                                 │  - import-users │
┌──────────────┐    sync      ┌────────────────────┐            │  - import-bins  │
│  Azure AD    │ ────────────► │  Power Automate    │ ─────────► └─────────────────┘
│  (Users)     │              └────────────────────┘
└──────────────┘

┌──────────────┐    SMTP      ┌────────────────────┐
│  Office 365  │ ◄──────────  │  Supabase Auth     │
│  (Email)     │              │  (built-in OTP)    │
└──────────────┘              └────────────────────┘

┌──────────────┐              ┌────────────────────┐
│  Browser     │ ◄──────────► │  Supabase DB       │
│  (index.html)│   realtime   │  (PostgreSQL)      │
└──────────────┘              └────────────────────┘
```

---

## 6. Out of Scope (Observed)

- Reporting exports (no CSV/PDF generation observed)
- Push notifications (no FCM or service worker observed)
- Offline mode (no IndexedDB or service worker caching observed)
- Multi-language / i18n support

---

*This spec was auto-generated from codebase analysis. Review and update as the system evolves.*
