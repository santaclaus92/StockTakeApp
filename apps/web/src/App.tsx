import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { IdentityProvider, useIdentity } from "./app/IdentityContext";
import type { AppIdentity } from "./app/IdentityContext";
import { getSupabaseAuthClient, getSupabaseAuthConfigError } from "./services/supabaseAuth";
import "./styles.css";

const queryClient = new QueryClient();
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

interface PrecheckResponse {
  found: boolean;
  id: string;
  email: string;
  name: string;
  role: "User" | "Admin" | "Super Admin";
}

interface ResolveIdentityResponse {
  id: string;
  email: string;
  name: string;
  role: "User" | "Admin" | "Super Admin";
}

function normalizeRole(role: string): AppIdentity["role"] {
  if (role === "Admin" || role === "Super Admin") {
    return role;
  }
  return "User";
}

async function precheckEmail(email: string): Promise<PrecheckResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/precheck`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Email is not allowed to access this application.");
  }
  return (await response.json()) as PrecheckResponse;
}

async function resolveIdentity(email: string, accessToken: string): Promise<ResolveIdentityResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/resolve-identity`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ email })
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Unable to resolve role.");
  }
  return (await response.json()) as ResolveIdentityResponse;
}

export function App() {
  return (
    <IdentityProvider>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <RouterProvider router={router} />
        </AuthGate>
      </QueryClientProvider>
    </IdentityProvider>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { identity, signIn } = useIdentity();
  const defaultMode = import.meta.env.MODE === "test" ? "local" : "supabase";
  const ssoMode = ((import.meta.env.VITE_SSO_MODE as string | undefined) ?? defaultMode).toLowerCase();

  if (identity) {
    return <>{children}</>;
  }

  if (ssoMode === "local") {
    return <LocalOtpForm onSignedIn={signIn} />;
  }

  return <SupabaseOtpForm onSignedIn={signIn} />;
}

function LocalOtpForm({ onSignedIn }: { onSignedIn: (identity: AppIdentity) => void }) {
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const normalizedEmail = email.trim().toLowerCase();

  return (
    <div className="sso-overlay" role="dialog" aria-modal="true" aria-label="SSO Sign-In">
      <form
        ref={formRef}
        className="sso-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (!normalizedEmail) return;
          if (!otpSent) {
            setOtpSent(true);
            setStatusMessage("Test mode OTP sent. Use 000000.");
            return;
          }

          if (otpCode.trim() !== "000000") {
            setStatusMessage("Invalid OTP in local mode. Use 000000.");
            return;
          }

          const fallbackName = normalizedEmail.split("@")[0] || "User";
          onSignedIn({
            id: `local-${normalizedEmail}`,
            email: normalizedEmail,
            name: fallbackName,
            role: "Admin"
          });
        }}
      >
        <h2>Sign In</h2>
        <p>{otpSent ? "Enter 6-digit OTP." : "Enter your company email to receive OTP."}</p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            disabled={otpSent}
          />
        </label>
        {otpSent ? (
          <label>
            OTP
            <input
              value={otpCode}
              onChange={(event) => {
                const val = event.target.value;
                setOtpCode(val);
                if (val.length === 6) formRef.current?.requestSubmit();
              }}
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
            />
          </label>
        ) : null}
        {statusMessage ? <p className="muted">{statusMessage}</p> : null}
        <button type="submit" className="primary-btn">
          {otpSent ? "Verify & Continue" : "Send OTP"}
        </button>
      </form>
    </div>
  );
}

function SupabaseOtpForm({ onSignedIn }: { onSignedIn: (identity: AppIdentity) => void }) {
  const client = getSupabaseAuthClient();
  const configError = getSupabaseAuthConfigError();
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const normalizedEmail = email.trim().toLowerCase();

  if (!client) {
    return (
      <div className="sso-overlay" role="dialog" aria-modal="true" aria-label="SSO Sign-In">
        <div className="sso-card">
          <h2>SSO Sign-In</h2>
          <p>{configError ?? "Supabase authentication is not configured."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sso-overlay" role="dialog" aria-modal="true" aria-label="SSO Sign-In">
      <form
        ref={formRef}
        className="sso-card"
        onSubmit={(event) => {
          event.preventDefault();
          void (async () => {
            try {
              if (!normalizedEmail) return;
              setStatusMessage("");

              if (!otpSent) {
                setIsSending(true);
                await precheckEmail(normalizedEmail);
                const { error } = await client.auth.signInWithOtp({
                  email: normalizedEmail,
                  options: {
                    shouldCreateUser: true
                  }
                });
                if (error) throw error;
                setOtpSent(true);
                setStatusMessage(`OTP sent to ${normalizedEmail}.`);
                return;
              }

              const token = otpCode.trim();
              if (!token) return;

              setIsVerifying(true);
              const { data, error } = await client.auth.verifyOtp({
                email: normalizedEmail,
                token,
                type: "email"
              });
              if (error) throw error;
              if (!data.user) throw new Error("Authenticated user not returned by Supabase.");

              const accessToken = data.session?.access_token ?? (await client.auth.getSession()).data.session?.access_token;
              if (!accessToken) throw new Error("No access token after OTP verification.");

              const resolved = await resolveIdentity(normalizedEmail, accessToken);

              await client.auth.updateUser({
                data: {
                  role: resolved.role,
                  display_name: resolved.name
                }
              });

              onSignedIn({
                id: resolved.id,
                email: resolved.email,
                name: resolved.name,
                role: normalizeRole(resolved.role)
              });
            } catch (error) {
              const message = (error as Error).message || "SSO sign-in failed.";
              if (/Invalid API key/i.test(message)) {
                setStatusMessage(
                  `${message} Check VITE_SUPABASE_ANON_KEY. Use public/anon key (\`sb_publishable_...\` or legacy \`eyJ...\`), not service-role \`sb_secret_...\`.`
                );
              } else {
                setStatusMessage(message);
              }
            } finally {
              setIsSending(false);
              setIsVerifying(false);
            }
          })();
        }}
      >
        <h2>Sign In</h2>
        <p>{otpSent ? "Enter 6-digit OTP sent to your email." : "Enter your company email to receive OTP."}</p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            disabled={otpSent}
          />
        </label>
        {otpSent ? (
          <label>
            OTP
            <input
              value={otpCode}
              onChange={(event) => {
                const val = event.target.value;
                setOtpCode(val);
                if (val.length === 6) formRef.current?.requestSubmit();
              }}
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
            />
          </label>
        ) : null}
        {statusMessage ? <p className="muted">{statusMessage}</p> : null}
        <button type="submit" className="primary-btn" disabled={isSending || isVerifying}>
          {otpSent ? (isVerifying ? "Verifying..." : "Verify & Continue") : isSending ? "Sending..." : "Send OTP"}
        </button>
      </form>
    </div>
  );
}
