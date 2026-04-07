/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { UserRoleRecord } from "../types/domain";

const STORAGE_KEY = "sta_identity";

export interface AppIdentity {
  id: string;
  name: string;
  email: string;
  role: UserRoleRecord["role"];
}

interface IdentityContextValue {
  identity: AppIdentity | null;
  signIn: (identity: AppIdentity) => void;
  signOut: () => void;
}

const IdentityContext = createContext<IdentityContextValue | undefined>(undefined);

function readStoredIdentity(): AppIdentity | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppIdentity;
    if (!parsed?.id || !parsed?.name || !parsed?.email || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<AppIdentity | null>(() => readStoredIdentity());

  const value = useMemo<IdentityContextValue>(
    () => ({
      identity,
      signIn: (nextIdentity) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextIdentity));
        setIdentity(nextIdentity);
      },
      signOut: () => {
        localStorage.removeItem(STORAGE_KEY);
        setIdentity(null);
      }
    }),
    [identity]
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity() {
  const context = useContext(IdentityContext);
  if (!context) {
    throw new Error("useIdentity must be used within IdentityProvider");
  }
  return context;
}
