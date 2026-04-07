# Baseline Parity Checklist

This checklist tracks existing behavior that must still work after refactoring.

## Admin Flows

- [x] View sessions list
- [x] Create new session
- [x] Open session details
- [x] Pair assignment CRUD
- [x] Attendance read/write
- [x] Stock count item master view
- [x] Dashboard metrics view
- [x] Audit trail view
- [x] New item gallery view
- [x] Approval actions for pending changes

## Warehouse Flows

- [x] Open warehouse home
- [x] Search assigned items
- [x] Submit count input
- [ ] View count history

## Integration Flows

- [x] Import bins via webhook/edge flow
- [x] Import users via webhook/edge flow
- [x] Import items via webhook/edge flow
- [ ] Supabase auth/session still functional

## Regression Safety

- [x] Legacy unit tests pass
- [x] New web tests pass
- [x] New api tests pass
