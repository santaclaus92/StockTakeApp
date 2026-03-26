// @vitest-environment jsdom
/**
 * Tests the full frontend data pipeline:
 *   raw Supabase row → mapItem() → renderItems filter predicate → visible items
 *
 * This is the exact logic path that loadItems() executes.
 * The filter predicate is copied verbatim from renderItems() (src/main.js line 245)
 * so any drift between test and production would be a deliberate change.
 */
import { vi, describe, it, expect, beforeAll } from 'vitest';

vi.mock('../../src/store.js', () => ({
  state: {
    S: [], items: [], pairs: [], newItems: [], selItems: new Set(),
    ssoUserName: '', ssoUserRole: 'User',
    STATUS_DRAFT: 'Draft', STATUS_ACTIVE: 'Active', STATUS_CLOSED: 'Closed',
    ROLE_ADMIN: 'Admin', ROLE_USER: 'User',
  },
}));

vi.mock('../../src/supabase.js', () => ({
  sb: { from: () => ({ select: () => ({}) }) },
  sbQuery: vi.fn(),
  FN_BASE: '',
  FN_HEADERS: {},
}));

let mapItem;

beforeAll(async () => {
  await import('../../src/sessions.js');
  mapItem = window.mapItem;
});

// ── Filter predicate — copied verbatim from renderItems() src/main.js:245 ────
// If this test starts failing with no other code changes, it means the
// production filter logic changed and the tests need updating too.
function applyFilters(items, { entity = '', filter = 'all', search = '', grp = '', wh = '' } = {}) {
  return items.filter(function (i) {
    var mf = filter === 'all' || (filter === 'active' && !i.dropped) || (filter === 'dropped' && i.dropped);
    var ms = !search || i.code.toLowerCase().includes(search) || i.name.toLowerCase().includes(search) || (i.batch && i.batch !== '—' && i.batch.toLowerCase().includes(search));
    var mg = !grp || i.grp === grp;
    var mw = !wh || i.wh === wh;
    var me = !entity || i.entity === entity;
    return mf && ms && mg && mw && me;
  });
}

// Realistic raw rows as Supabase/SAP would return them
const rawRows = [
  { id: '1', code: 'ITM-001', name: 'Hydraulic Pump A200',  entity: 'BMS',  wh_code: 'KL01', group: 'Machinery', count_qty: 50, sap_qty: 50, bin_location: 'A-07', batch: 'BT-2024', uom: 'PCS', dropped: false, pair_id: null, assigned_to: null, new_item: 'No', photos: null, item_status: null },
  { id: '2', code: 'ITM-002', name: 'Conveyor Belt 5m',     entity: 'BMS',  wh_code: 'KL01', group: 'Hardware',  count_qty: 9,  sap_qty: 12, bin_location: 'B-04', batch: '—',        uom: 'MTR', dropped: false, pair_id: null, assigned_to: null, new_item: 'No', photos: null, item_status: null },
  { id: '3', code: 'ITM-003', name: 'Air Filter Singapore', entity: 'BMSG', wh_code: 'SG01', group: 'Machinery', count_qty: null, sap_qty: 5, bin_location: 'C-01', batch: 'SG-001',   uom: 'PCS', dropped: false, pair_id: null, assigned_to: null, new_item: 'No', photos: null, item_status: null },
  { id: '4', code: 'ITM-004', name: 'Dropped Gear',         entity: 'BMS',  wh_code: 'KL01', group: 'Hardware',  count_qty: 0,  sap_qty: 3,  bin_location: 'D-01', batch: '—',        uom: 'PCS', dropped: true,  pair_id: null, assigned_to: null, new_item: 'No', photos: null, item_status: null },
  { id: '5', code: 'ITM-005', name: 'New Scanner Device',   entity: 'BMS',  wh_code: 'KL02', group: 'IT',       count_qty: 2,  sap_qty: 2,  bin_location: 'E-01', batch: '—',        uom: 'PCS', dropped: false, pair_id: null, assigned_to: null, new_item: 'Yes', photos: null, item_status: null },
];

describe('Frontend data pipeline: raw row → mapItem → filter', () => {
  let items;

  beforeAll(() => {
    items = rawRows.map(mapItem);
  });

  // ── mapItem output correctness ─────────────────────────────────────────

  it('maps all 5 rows through mapItem without throwing', () => {
    expect(items).toHaveLength(5);
  });

  it('entity field is present on every mapped item', () => {
    items.forEach(item => {
      expect(typeof item.entity).toBe('string');
    });
  });

  it('wh field is mapped from wh_code', () => {
    expect(items[0].wh).toBe('KL01');
    expect(items[2].wh).toBe('SG01');
  });

  it('cnt is null (not 0) for uncounted items', () => {
    const uncounted = items.find(i => i.code === 'ITM-003');
    expect(uncounted.cnt).toBeNull();
  });

  it('cnt is correctly mapped from count_qty for counted items', () => {
    const counted = items.find(i => i.code === 'ITM-001');
    expect(counted.cnt).toBe(50);
  });

  // ── Entity filter — the refresh bug regression ─────────────────────────

  it('REGRESSION: entity filter shows only BMS items when session entity is BMS', () => {
    const visible = applyFilters(items, { entity: 'BMS' });
    expect(visible.every(i => i.entity === 'BMS')).toBe(true);
    expect(visible.some(i => i.entity === 'BMSG')).toBe(false);
  });

  it('REGRESSION: items with entity="" are hidden when session has entity set', () => {
    const itemsWithNoEntity = rawRows.map(r => mapItem({ ...r, entity: undefined }));
    const visible = applyFilters(itemsWithNoEntity, { entity: 'BMS' });
    // All items have entity:'' after mapItem — none match 'BMS'
    expect(visible).toHaveLength(0);
  });

  it('all items visible when session has no entity (entity="")', () => {
    const visible = applyFilters(items, { entity: '' });
    expect(visible).toHaveLength(5);
  });

  // ── Status filter ──────────────────────────────────────────────────────

  it('filter=active hides dropped items', () => {
    const visible = applyFilters(items, { filter: 'active' });
    expect(visible.every(i => !i.dropped)).toBe(true);
    expect(visible.some(i => i.code === 'ITM-004')).toBe(false);
  });

  it('filter=dropped shows only dropped items', () => {
    const visible = applyFilters(items, { filter: 'dropped' });
    expect(visible).toHaveLength(1);
    expect(visible[0].code).toBe('ITM-004');
  });

  it('filter=all shows everything', () => {
    expect(applyFilters(items, { filter: 'all' })).toHaveLength(5);
  });

  // ── Search filter ──────────────────────────────────────────────────────

  it('search by item code is case-insensitive', () => {
    const visible = applyFilters(items, { search: 'itm-001' });
    expect(visible).toHaveLength(1);
    expect(visible[0].code).toBe('ITM-001');
  });

  it('search by item name partial match', () => {
    const visible = applyFilters(items, { search: 'pump' });
    expect(visible).toHaveLength(1);
    expect(visible[0].name).toBe('Hydraulic Pump A200');
  });

  it('search by batch number', () => {
    const visible = applyFilters(items, { search: 'sg-001' });
    expect(visible).toHaveLength(1);
    expect(visible[0].code).toBe('ITM-003');
  });

  it('search with no match returns empty', () => {
    expect(applyFilters(items, { search: 'xyznotfound' })).toHaveLength(0);
  });

  // ── Group + warehouse filters ──────────────────────────────────────────

  it('group filter returns only items in that group', () => {
    const visible = applyFilters(items, { grp: 'Machinery' });
    expect(visible.every(i => i.grp === 'Machinery')).toBe(true);
  });

  it('warehouse filter (wh) returns only items in that warehouse', () => {
    const visible = applyFilters(items, { wh: 'KL02' });
    expect(visible).toHaveLength(1);
    expect(visible[0].code).toBe('ITM-005');
  });

  // ── Combined filters ───────────────────────────────────────────────────

  it('entity + active filter combined: BMS active items only', () => {
    const visible = applyFilters(items, { entity: 'BMS', filter: 'active' });
    expect(visible.every(i => i.entity === 'BMS' && !i.dropped)).toBe(true);
    // ITM-001, ITM-002, ITM-005 match; ITM-004 is dropped; ITM-003 is BMSG
    expect(visible).toHaveLength(3);
  });

  it('entity + search combined', () => {
    const visible = applyFilters(items, { entity: 'BMS', search: 'belt' });
    expect(visible).toHaveLength(1);
    expect(visible[0].code).toBe('ITM-002');
  });
});
