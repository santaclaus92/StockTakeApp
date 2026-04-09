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

      const role = normalizeRole(data.user.app_metadata?.role);

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
