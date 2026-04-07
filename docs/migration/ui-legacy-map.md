# UI Legacy Mapping Matrix (Vanilla -> React)

## Scope
- Legacy source: `index.html` + `src/main.js` + `src/sessions.js` + `src/styles/index.css`
- React source: `apps/web/src/**/*`
- Backend behavior is intentionally out of scope for this pass.

## App Shell + Navigation
| Legacy Module | React Module | Notes |
|---|---|---|
| Sidebar + sectioned nav (`Admin`, `Warehouse`) | `apps/web/src/components/layout/TopNav.tsx` | Role-based sections preserved (`User` sees warehouse-only). |
| Top breadcrumb / topbar | `apps/web/src/app/AppLayout.tsx` | Session breadcrumb now resolves to live session name on detail route. |
| Global tokens/theme | `apps/web/src/styles.css` | Legacy token palette and shell structure retained. |

## Auth / Sign-In Overlay
| Legacy Module | React Module | Notes |
|---|---|---|
| SSO overlay email + OTP steps | `apps/web/src/App.tsx` (`SupabaseOtpForm`, `LocalOtpForm`) | Email-first OTP flow preserved with precheck + resolve identity calls. |

## Admin Homepage (Sessions)
| Legacy Module | React Module | Notes |
|---|---|---|
| Sessions table + actions | `apps/web/src/pages/AdminHomePage.tsx` | Open/Edit/Reopen/Delete preserved. |
| Session row visual states | `apps/web/src/pages/AdminHomePage.tsx`, `apps/web/src/styles.css` | Status badges, progress bar, recount badge, hidden-session row opacity mapped to legacy behavior. |
| New/Edit session modal | `apps/web/src/components/admin/NewSessionModal.tsx` | Recount + parent session selection preserved. |

## Session Detail Header + Tabs
| Legacy Module | React Module | Notes |
|---|---|---|
| Session header card/actions | `apps/web/src/components/admin/SessionHeader.tsx` | Visibility, strict-role toggle, dashboard, end-session actions mapped. |
| Session sub-tabs (`Pair`, `Attendance`, `Item Master`, `Dashboard`, `Gallery`, `Audit`, `Pending`) | `apps/web/src/pages/AdminSessionPage.tsx` | Same tab order and pending badge behavior. |
| TV overlay | `apps/web/src/components/admin/TvDashboardOverlay.tsx` | Fullscreen TV view retained. |

## Session Tabs
| Legacy Module | React Module | Notes |
|---|---|---|
| Pair Assignment | `apps/web/src/components/admin/tabs/PairAssignmentTab.tsx` | Card grid, absent highlighting, strict-role control, recount drawer item table + search/filter, and absent-member repair replacement workflow. |
| Attendance | `apps/web/src/components/admin/tabs/AttendanceTab.tsx` | QR token block, manual add, time edit, present/absent cards. |
| Item Master | `apps/web/src/components/admin/tabs/StockCountTab.tsx` | Filters, bulk assign, column menu, drop/recover, import/export, photos, remarks. |
| Dashboard | `apps/web/src/components/admin/tabs/DashboardTab.tsx` | KPI + drilldown tables/modal. |
| Audit Trail | `apps/web/src/components/admin/tabs/AuditTrailTab.tsx` | Legacy table columns retained. |
| New Item Gallery | `apps/web/src/components/admin/tabs/NewItemGalleryTab.tsx` | Gallery card + approval actions retained; metadata now includes `UOM` and `Serial / Batch`. |
| Pending Approval | `apps/web/src/components/admin/tabs/ApprovalTab.tsx` | Old/new qty + old/new bin + approve/reject controls retained. |

## Warehouse
| Legacy Module | React Module | Notes |
|---|---|---|
| Session picker + active session bar | `apps/web/src/pages/WarehousePage.tsx` | Session-select-first flow retained. |
| Search/scan/multi-scan/new/layout actions | `apps/web/src/pages/WarehousePage.tsx` | Action cluster retained with role/session visibility rules (multi-scan for privileged roles, new-item hidden for recount sessions), live multi-scan scan-log/counter workflow, and detailed new-item submission fields (uom/batch/qty/damaged/expired/remark/photos). |
| Result gallery + assigned gallery | `apps/web/src/components/warehouse/WarehouseGallery.tsx` | Card-gallery parity retained with click-to-open detail behavior. |
| Count form | `apps/web/src/components/warehouse/CountInputForm.tsx` | Search/detail split retained with `Back to search` detail mode and count form fields. |
| Count history | `apps/web/src/pages/CountHistoryPage.tsx` | Warehouse history page retained. |

## Current UI Parity Focus
1. No open UI parity blockers in the migrated React scope.
2. Keep browser smoke checks (desktop/tablet/mobile) in normal release QA for future visual changes.
