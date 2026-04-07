import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import { IdentityProvider } from "../app/IdentityContext";
import type { UserRoleRecord } from "../types/domain";

interface TestIdentity {
  id: string;
  name: string;
  email: string;
  role: UserRoleRecord["role"];
}

const defaultIdentity: TestIdentity = {
  id: "test-user",
  name: "Test User",
  email: "test@example.com",
  role: "Admin"
};

export function renderWithProviders(ui: ReactElement, route = "/", identity: TestIdentity = defaultIdentity) {
  localStorage.setItem(
    "sta_identity",
    JSON.stringify(identity)
  );

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <IdentityProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </IdentityProvider>
  );
}
