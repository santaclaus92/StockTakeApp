import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useIdentity } from "./IdentityContext";
import type { UserRoleRecord } from "../types/domain";

interface RoleGuardProps {
  allow: UserRoleRecord["role"][];
}

export function RoleGuard({ allow }: RoleGuardProps) {
  const { identity } = useIdentity();
  const location = useLocation();
  const role = identity?.role ?? "User";

  if (!allow.includes(role)) {
    const target = role === "User" ? "/warehouse" : "/";
    if (location.pathname === target) {
      return <Outlet />;
    }
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
