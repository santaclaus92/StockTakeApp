import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthUser, AuthVerifier, UserRole } from "../middleware/auth";

function normalizeRole(value: unknown): UserRole {
  if (value === "Admin" || value === "Super Admin") {
    return value;
  }
  return "User";
}

export function createSupabaseAuthVerifier(client: SupabaseClient): AuthVerifier {
  return {
    async verifyToken(token: string): Promise<AuthUser | null> {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) {
        return null;
      }

      let role = normalizeRole(data.user.app_metadata?.role ?? data.user.user_metadata?.role);
      const email = data.user.email?.toLowerCase() ?? "";
      if (email) {
        const { data: userRow } = await client
          .from("users")
          .select("role")
          .ilike("email", email)
          .limit(1)
          .maybeSingle();

        if (userRow) {
          role = normalizeRole((userRow as { role?: unknown }).role);
        }
      }

      return {
        id: data.user.id,
        email: data.user.email ?? null,
        role
      };
    }
  };
}

export const noAuthVerifier: AuthVerifier = {
  verifyToken: async () => null
};
