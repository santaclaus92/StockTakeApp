import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;
  return value.toLowerCase() === "true";
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4001),
  SUPABASE_URL: z.string().url().or(z.literal("")).default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).or(z.literal("")).default(""),
  SUPABASE_EDGE_FUNCTION_KEY: z.string().optional(),
  API_AUTH_REQUIRED: booleanFromEnv.default(false),
  DEV_FALLBACK_ROLE: z.enum(["User", "Admin", "Super Admin"]).default("Admin"),
  PA_BINS_URL: z.string().url().optional(),
  PA_BINS_PAGE_SIZE: z.coerce.number().int().positive().max(5000).default(1000),
  PA_BINS_MAX_PAGES: z.coerce.number().int().positive().max(1000).default(200),
  PA_USERS_URL: z.string().url().optional(),
  PA_USERS_PAGE_SIZE: z.coerce.number().int().positive().max(5000).default(1000),
  PA_USERS_MAX_PAGES: z.coerce.number().int().positive().max(1000).default(200),
  PA_ITEMS_URL: z.string().url().optional(),
  PA_ITEMS_PAGE_SIZE: z.coerce.number().int().positive().max(5000).default(1000),
  PA_ITEMS_MAX_PAGES: z.coerce.number().int().positive().max(1000).default(200),
  WEBHOOK_SHARED_SECRET: z.string().optional(),
  WEBHOOK_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  WEBHOOK_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  WEBHOOK_IDEMPOTENCY_TTL_MS: z.coerce.number().int().positive().default(600_000),
  DATA_SOURCE: z.enum(["supabase", "memory"]).default("supabase")
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(env: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(env);
}
