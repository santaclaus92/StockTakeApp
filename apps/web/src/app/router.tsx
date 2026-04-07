import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { AdminHomePage } from "../pages/AdminHomePage";
import { AdminSessionPage } from "../pages/AdminSessionPage";
import { CountHistoryPage } from "../pages/CountHistoryPage";
import { HomePage } from "../pages/HomePage";
import { WarehousePage } from "../pages/WarehousePage";
import { RoleGuard } from "./RoleGuard";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        element: <RoleGuard allow={["Admin", "Super Admin"]} />,
        children: [
          { path: "admin", element: <AdminHomePage /> },
          { path: "admin/sessions/:sessionId", element: <AdminSessionPage /> }
        ]
      },
      {
        element: <RoleGuard allow={["User", "Admin", "Super Admin"]} />,
        children: [
          { path: "history", element: <CountHistoryPage /> },
          { path: "warehouse", element: <WarehousePage /> }
        ]
      }
    ]
  }
]);
