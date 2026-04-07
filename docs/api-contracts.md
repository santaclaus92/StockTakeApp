# API Contracts (Section 3 Snapshot)

Base URL: `/api`

## Health

- `GET /health`

## Sessions

- `GET /sessions`
- `POST /sessions`
- `GET /sessions/:sessionId`

## Pairs

- `GET /sessions/:sessionId/pairs`
- `POST /sessions/:sessionId/pairs`
- `GET /pairs?sessionId=...`
- `POST /pairs`
- `PUT /pairs/:id`
- `DELETE /pairs/:id`

## Attendance

- `GET /sessions/:sessionId/attendance`
- `PATCH /sessions/:sessionId/attendance/:userId/toggle`
- `GET /attendance?sessionId=...`
- `POST /attendance`
- `PUT /attendance`

## Items and Dashboard

- `POST /bins/import-from-pa`
- `POST /users/import-from-pa`
- `POST /sessions/:sessionId/items/import-from-sap`
- `GET /sessions/:sessionId/items`
- `PATCH /sessions/:sessionId/items/:itemId/count`
- `GET /items?sessionId=...`
- `PUT /items/:itemId/count`
- `GET /sessions/:sessionId/dashboard`

### Import telemetry response fields

- `POST /bins/import-from-pa`: returns `imported`, `received`, `pagesFetched`
- `POST /users/import-from-pa`: returns `imported`, `received`, `pagesFetched`, and optional `reset`
- `POST /sessions/:sessionId/items/import-from-sap`: returns `imported`, `received`, `deduped`, `pagesFetched`

## Audit

- `GET /sessions/:sessionId/audit`
- `GET /audit?sessionId=...`
- `POST /audit`

## New Items

- `GET /sessions/:sessionId/new-items`
- `GET /new-items?sessionId=...`
- `POST /new-items`
- `PUT /new-items/:id`

## Approvals

- `GET /sessions/:sessionId/approvals`
- `POST /sessions/:sessionId/approvals/:approvalId/approve`
- `POST /sessions/:sessionId/approvals/:approvalId/reject`
- `POST /approvals/:id/approve`
- `POST /approvals/:id/reject`

### Approval Consistency

- approval review is single-shot (`Pending` -> `Approved`/`Rejected`), replay attempts return conflict
- when Supabase migration `20260406_approval_atomic_rpc.sql` is applied, approve path runs as one transactional RPC

## Warehouse

- `GET /warehouse/items?query=...`
- `GET /warehouse/assigned?assignee=...`
- `POST /warehouse/counts`

## Webhooks

- `POST /webhooks/bins/import`
- `POST /webhooks/users/import`
- `POST /webhooks/items/import`

### Webhook security headers

- `x-webhook-secret`: required when `WEBHOOK_SHARED_SECRET` is configured
- `idempotency-key`: optional; duplicate keys replay cached response within TTL

## Error Shape

All errors return JSON:

```json
{
  "message": "...",
  "details": {},
  "requestId": "..."
}
```
