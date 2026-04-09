import { useState } from "react";
import { useUpdateUserRoleMutation, useUsersQuery } from "../../hooks/useAdminData";
import { useIdentity } from "../../app/IdentityContext";
import type { UserRoleRecord } from "../../types/domain";
import { BannerModal } from "../ui/BannerModal";

interface UsersRolesModalProps {
  open: boolean;
  onClose: () => void;
}

const roleOptions: UserRoleRecord["role"][] = ["User", "Admin", "Super Admin"];

export function UsersRolesModal({ open, onClose }: UsersRolesModalProps) {
  const { identity } = useIdentity();
  const usersQuery = useUsersQuery();
  const { data: users = [], isLoading } = usersQuery;
  const updateRole = useUpdateUserRoleMutation();
  const [search, setSearch] = useState("");
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);
  const [roleFeedback, setRoleFeedback] = useState<{ type: "success" | "warning"; text: string } | null>(null);

  const handleRoleChange = async (userId: string, role: UserRoleRecord["role"]) => {
    setSyncingUserId(userId);
    try {
      await updateRole.mutateAsync({ userId, role });
      await usersQuery.refetch();
      setRoleFeedback({ type: "success", text: "Role updated successfully." });
    } catch (error) {
      setRoleFeedback({ type: "warning", text: (error as Error).message || "Failed to update role." });
    } finally {
      setSyncingUserId(null);
    }
  };

  if (!open) return null;

  const filtered = search.trim()
    ? users.filter((u) => u.name.toLowerCase().includes(search.trim().toLowerCase()))
    : users;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Users and Roles">
      <section className="modal" style={{ width: "60vw", minWidth: "600px", maxWidth: "1200px", minHeight: "60vh", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <header>
          <h2>Users & Roles</h2>
          <button type="button" onClick={onClose} className="ghost-btn">
            X
          </button>
        </header>
        <div style={{ padding: "8px 16px" }}>
          <input
            type="search"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
        {roleFeedback ? (
          <BannerModal
            type={roleFeedback.type}
            message={roleFeedback.text}
            onClose={() => setRoleFeedback(null)}
          />
        ) : null}
        {isLoading ? <p>Loading users...</p> : null}
        <table className="legacy-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const isSyncing = syncingUserId === user.id;
              return (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email ?? "-"}</td>
                  <td style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <select
                      value={user.role}
                      disabled={identity?.role !== "Super Admin" || isSyncing}
                      onChange={(event) => void handleRoleChange(user.id, event.target.value as UserRoleRecord["role"])}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    {isSyncing ? <span className="muted" style={{ fontSize: 11 }}>Syncing…</span> : null}
                  </td>
                  <td>{user.accountEnabled === false ? "Disabled" : "Active"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {identity?.role !== "Super Admin" ? (
          <p className="muted">Only Super Admin can change roles in this view.</p>
        ) : null}
      </section>
    </div>
  );
}
