import { Navigate } from "react-router-dom";
import { useIdentity } from "../app/IdentityContext";

export function HomePage() {
  const { identity } = useIdentity();
  const role = identity?.role ?? "User";
  const isAdmin = role === "Admin" || role === "Super Admin";

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  return <Navigate to="/warehouse" replace />;
}
