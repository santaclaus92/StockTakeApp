import { createApp } from "./app";
import { getEnv } from "./config/env";
import { loadStartupEnv } from "./config/load-startup-env";
import { createSupabaseAuthVerifier } from "./lib/auth-verifier";
import { createSupabaseAdminClient } from "./lib/supabase-client";
import { createInMemoryStaRepository } from "./repositories/memory-sta-repository";
import { createSupabaseStaRepository } from "./repositories/supabase-sta-repository";

const loadedEnvPath = loadStartupEnv();
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
        const { data: currentUser, error: fetchError } = await supabaseClient.auth.admin.getUserById(userId);
        if (fetchError || !currentUser.user) {
          // User exists in DB but not in Supabase Auth (e.g. imported manually) — skip metadata sync
          console.warn(`syncRole: auth user not found for id=${userId}, skipping app_metadata update`);
          return;
        }
        const currentMetadata = currentUser.user.app_metadata ?? {};
        const { error } = await supabaseClient.auth.admin.updateUserById(userId, {
          app_metadata: {
            ...currentMetadata,
            role
          }
        });
        if (error) throw error;
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

app.listen(env.PORT, () => {
  const dataSource = useSupabase ? "supabase" : "memory";
  if (loadedEnvPath) {
    console.log(`Loaded environment from ${loadedEnvPath}`);
  }
  console.log(`STA API listening at http://localhost:${env.PORT} (dataSource=${dataSource})`);
});
