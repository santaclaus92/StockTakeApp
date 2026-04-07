import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null | undefined;

function isLikelySupabasePublicKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("eyJ");
}

export function validateSupabaseAuthConfigValues(url?: string, anonKey?: string): string | null {
  const normalizedUrl = url?.trim() ?? "";
  const normalizedAnonKey = anonKey?.trim() ?? "";

  if (!normalizedUrl || !normalizedAnonKey) {
    return "Supabase keys are missing. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.";
  }

  try {
    new URL(normalizedUrl);
  } catch {
    return "VITE_SUPABASE_URL is invalid. Use your project URL (for example `https://<project-ref>.supabase.co`).";
  }

  if (normalizedAnonKey.startsWith("sb_secret_")) {
    return "VITE_SUPABASE_ANON_KEY is using a secret key. Use your public/anon key (`sb_publishable_...` or legacy `eyJ...`).";
  }

  if (!isLikelySupabasePublicKey(normalizedAnonKey)) {
    return "VITE_SUPABASE_ANON_KEY format looks invalid. Use Supabase public/anon key (`sb_publishable_...` or legacy `eyJ...`).";
  }

  return null;
}

export function getSupabaseAuthConfigError(): string | null {
  return validateSupabaseAuthConfigValues(
    import.meta.env.VITE_SUPABASE_URL as string | undefined,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  );
}

export function getSupabaseAuthClient(): SupabaseClient | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  const configError = validateSupabaseAuthConfigValues(url, anonKey);
  if (configError || !url || !anonKey) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      detectSessionInUrl: true,
      autoRefreshToken: true,
      persistSession: true
    }
  });
  return cachedClient;
}
