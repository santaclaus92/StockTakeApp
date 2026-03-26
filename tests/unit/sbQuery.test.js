// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Prevent real Supabase client from being created
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { flowType: 'implicit' } }),
}));

let sbQuery;

beforeEach(async () => {
  vi.resetModules();
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  const mod = await import('../../src/supabase.js');
  sbQuery = mod.sbQuery;
});

describe('sbQuery — centralised Supabase error handler', () => {
  it('returns { data, error: null } on success', async () => {
    const result = await sbQuery(Promise.resolve({ data: [{ id: 1 }], error: null }));
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: 1 }]);
  });

  it('returns { error, data: null } and calls alert when res.error is set', async () => {
    const fakeError = { message: 'Row not found' };
    const result = await sbQuery(Promise.resolve({ data: null, error: fakeError }));
    expect(result.error).toBe(fakeError);
    expect(result.data).toBeNull();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Row not found'));
  });

  it('returns { error, data: null } and calls alert on network throw', async () => {
    const result = await sbQuery(Promise.reject(new Error('Network timeout')));
    expect(result.error).toBeDefined();
    expect(result.data).toBeNull();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Network Error'));
  });
});
