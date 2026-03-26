import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lyouqmjrzvcdevglunyc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5b3VxbWpyenZjZGV2Z2x1bnljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MjQ1OTYsImV4cCI6MjA4OTMwMDU5Nn0.xeR8GbU6NnP3-7GZENOLlWQi7uNvEYLUzeiwwhh1V34';

const _sbOptions = { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } };
export const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, _sbOptions) : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, _sbOptions);

export const FN_BASE = SUPABASE_URL + '/functions/v1';
export const FN_HEADERS = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY };

// ── Centralised Supabase Error Handling ───────────────────────────────────
export async function sbQuery(promise) {
  try {
    const res = await promise;
    if (res.error) {
      console.error('[Supabase Error]', res.error.message || res.error);
      alert('Database Error: ' + (res.error.message || 'Unknown error occurred.'));
      return { error: res.error, data: null };
    }
    return { error: null, data: res.data };
  } catch (err) {
    console.error('[Network Error]', err);
    alert('Network Error: Unable to reach the database.');
    return { error: err, data: null };
  }
}
