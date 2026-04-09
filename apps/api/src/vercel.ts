import { createApp } from "./app";
import { getEnv } from "./config/env";
import { loadStartupEnv } from "./config/load-startup-env";
import { createSupabaseAuthVerifier } from "./lib/auth-verifier";
import { createSupabaseAdminClient } from "./lib/supabase-client";
import { createInMemoryStaRepository } from "./repositories/memory-sta-repository";
import { createSupabaseStaRepository } from "./repositories/supabase-sta-repository";

loadStartupEnv();
const env = getEnv();

const useSupabase = env.DATA_SOURCE === "supabase";

if (useSupabase && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when DATA_SOURCE=supabase.");
}

const supabaseClient = useSupabase ? createSupabaseAdminClient(env) : null;
const repository = supabaseClient ? createSupabaseStaRepository(supabaseClient) : createInMemoryStaRepository();
const authVerifier = supabaseClient ? createSupabaseAuthVerifier(supabaseClient) : { verifyToken: async () => null };
const authMetadataSync = supabaseClient
  ? {
      syncRole: async (userId: string, role: "User" | "Admin" | "Super Admin") => {
        try {
          const currentUser = await supabaseClient.auth.admin.getUserById(userId);
          if (!currentUser.data.user) {
            // User does not exist in authentication table — skip auth metadata update
            return;
          }
          const currentMetadata = currentUser.data.user.app_metadata ?? {};
          const { error } = await supabaseClient.auth.admin.updateUserById(userId, {
            app_metadata: { ...currentMetadata, role }
          });
          if (error) {
            console.warn(`[syncRole] Failed to update auth metadata for ${userId}:`, error.message);
          }
        } catch (err) {
          // Never throw — users table was already updated; auth metadata sync is best-effort
          console.warn(`[syncRole] Unexpected error for ${userId}:`, err instanceof Error ? err.message : String(err));
        }
      }
    }
  : undefined;

const app = createApp({
  repository,
  authVerifier,
  authRequired: env.API_AUTH_REQUIRED,
  devFallbackRole: env.DEV_FALLBACK_ROLE,
  webhookSharedSecret: env.WEBHOOK_SHARED_SECRET,
  webhookRateLimitWindowMs: env.WEBHOOK_RATE_LIMIT_WINDOW_MS,
  webhookRateLimitMax: env.WEBHOOK_RATE_LIMIT_MAX,
  webhookIdempotencyTtlMs: env.WEBHOOK_IDEMPOTENCY_TTL_MS,
  authMetadataSync
});

export default app;
