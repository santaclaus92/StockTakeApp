// @vitest-environment jsdom
import { vi, describe, it, expect, beforeAll } from 'vitest';

// Stub store.js — mapItem doesn't need real state, but sessions.js imports it
vi.mock('../../src/store.js', () => ({
  state: {
    S: [], items: [], pairs: [], newItems: [], selItems: new Set(),
    ssoUserName: '', ssoUserEmail: '', ssoUserRole: 'User',
    STATUS_DRAFT: 'Draft', STATUS_ACTIVE: 'Active', STATUS_CLOSED: 'Closed',
    ROLE_ADMIN: 'Admin', ROLE_USER: 'User',
  },
}));

// Stub supabase.js — prevents real network client creation in test env
vi.mock('../../src/supabase.js', () => ({
  sb: { from: () => ({ select: () => ({}), update: () => ({}), delete: () => ({}) }) },
  sbQuery: vi.fn(),
  FN_BASE: 'http://localhost',
  FN_HEADERS: {},
}));

let mapItem;

beforeAll(async () => {
  // Importing sessions.js sets window.mapItem as a side effect
  await import('../../src/sessions.js');
  mapItem = window.mapItem;
});

describe('mapItem — Supabase/SAP row → normalized item object', () => {
  it('maps count_qty → cnt', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A', count_qty: 42 });
    expect(item.cnt).toBe(42);
  });

  it('maps sap_qty → sap', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A', sap_qty: 100 });
    expect(item.sap).toBe(100);
  });

  it('maps bin_location → warehouse', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A', bin_location: 'B-07' });
    expect(item.warehouse).toBe('B-07');
  });

  it('maps group → grp', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A', group: 'Machinery' });
    expect(item.grp).toBe('Machinery');
  });

  it('maps entity field (regression: entity missing caused items to disappear on refresh)', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A', entity: 'BMS' });
    expect(item.entity).toBe('BMS');
  });

  it('maps wh_code → wh', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A', wh_code: 'KL01' });
    expect(item.wh).toBe('KL01');
  });

  it('falls back to "—" for missing batch', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A' });
    expect(item.batch).toBe('—');
  });

  it('falls back to "PCS" for missing uom', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A' });
    expect(item.uom).toBe('PCS');
  });

  it('parses photos JSON string into array', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A', photos: '["url1","url2"]' });
    expect(item.photos).toEqual(['url1', 'url2']);
  });

  it('returns empty array for malformed photos JSON', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A', photos: 'not-json' });
    expect(Array.isArray(item.photos)).toBe(true);
    expect(item.photos.length).toBe(0);
  });

  it('strips time from expiry_date ISO string', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A', expiry_date: '2025-12-31T00:00:00Z' });
    expect(item.expiry).toBe('2025-12-31');
  });

  it('maps is_dropped alias → dropped', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A', is_dropped: true });
    expect(item.dropped).toBe(true);
  });

  it('REGRESSION: entity is "" when field absent — renderItems entity filter would hide all items', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A' });
    // This must return '' not undefined — renderItems uses (i.entity === entity) comparison
    expect(item.entity).toBe('');
  });

  it('cnt is null (not 0) when count_qty is absent', () => {
    const item = mapItem({ id: '1', code: 'A', name: 'A' });
    expect(item.cnt).toBeNull();
  });

  it('preserves array photos as-is', () => {
    const photos = ['http://a.com/1.jpg'];
    const item = mapItem({ id: '1', code: 'A', name: 'A', photos });
    expect(item.photos).toEqual(photos);
  });
});
