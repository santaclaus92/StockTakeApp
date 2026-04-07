import { describe, expect, it } from "vitest";
import { validateSupabaseAuthConfigValues } from "./supabaseAuth";

describe("validateSupabaseAuthConfigValues", () => {
  it("accepts publishable key format", () => {
    const result = validateSupabaseAuthConfigValues("https://example.supabase.co", "sb_publishable_xxx");
    expect(result).toBeNull();
  });

  it("accepts legacy anon jwt key format", () => {
    const result = validateSupabaseAuthConfigValues("https://example.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.foo.bar");
    expect(result).toBeNull();
  });

  it("rejects secret role key for frontend auth", () => {
    const result = validateSupabaseAuthConfigValues("https://example.supabase.co", "sb_secret_xxx");
    expect(result).toContain("secret key");
  });

  it("rejects invalid anon key format", () => {
    const result = validateSupabaseAuthConfigValues("https://example.supabase.co", "1234567890abcdef");
    expect(result).toContain("format looks invalid");
  });
});
