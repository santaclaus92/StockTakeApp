import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAttendanceQuery,
  useCreatePairMutation,
  useDeletePairMutation,
  useImportBinsFromPaMutation,
  useImportUsersFromPaMutation,
  useItemsQuery,
  usePairsQuery,
  useUpdatePairMutation,
  useUsersQuery
} from "../../../hooks/useAdminData";
import { useBinsQuery } from "../../../hooks/useWarehouseData";
import type { PairAssignment } from "../../../types/domain";
import { BannerModal } from "../../ui/BannerModal";

interface PairAssignmentTabProps {
  sessionId: string;
  isRecount: boolean;
  strictRoles: boolean;
  onToggleStrictRoles: () => Promise<void> | void;
}

type PairDraft = Omit<PairAssignment, "id">;
type DrawerFilter = "all" | "active" | "dropped";
type RepairTargetKey = "counter" | "checker" | "counter2";

interface RepairState {
  pairId: string;
  targetKey: RepairTargetKey;
  targetLabel: string;
  targetName: string;
}

const emptyDraft: PairDraft = {
  counter: "",
  checker: "",
  counter2: "",
  warehouse: "-",
  role: "User"
};

function splitBins(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => Boolean(value) && value !== "-");
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((chunk) => chunk[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function getAvailableOptions(
  allNames: string[],
  pairedNames: Set<string>,
  ownValue: string,
  otherValues: (string | undefined)[]
): string[] {
  const ownNormalized = normalizeName(ownValue);
  const otherNormalized = new Set(otherValues.filter(Boolean).map((v) => normalizeName(v!)));
  const result: string[] = [];
  const seen = new Set<string>();
  if (ownValue) {
    result.push(ownValue);
    seen.add(ownNormalized);
  }
  for (const name of allNames) {
    const normalized = normalizeName(name);
    if (seen.has(normalized)) continue;
    if (pairedNames.has(normalized)) continue;
    if (otherNormalized.has(normalized)) continue;
    result.push(name);
    seen.add(normalized);
  }
  return result;
}

export function PairAssignmentTab({ sessionId, isRecount, strictRoles, onToggleStrictRoles }: PairAssignmentTabProps) {
  const { data: pairs = [], isLoading } = usePairsQuery(sessionId);
  const { data: attendees = [] } = useAttendanceQuery(sessionId);
  const { data: items = [] } = useItemsQuery(sessionId);
  const { data: allBins = [] } = useBinsQuery(isRecount);
  const usersQuery = useUsersQuery();
  const importBins = useImportBinsFromPaMutation(sessionId);
  const importUsers = useImportUsersFromPaMutation(sessionId);
  const drawerSelectRef = useRef<HTMLSelectElement>(null);
  const createPair = useCreatePairMutation(sessionId);
  const updatePair = useUpdatePairMutation(sessionId);
  const deletePair = useDeletePairMutation(sessionId);

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<PairDraft>(emptyDraft);
  const [editingPairId, setEditingPairId] = useState<string | null>(null);
  const [drawerPairId, setDrawerPairId] = useState<string | null>(null);
  const [drawerSearch, setDrawerSearch] = useState("");
  const [drawerFilter, setDrawerFilter] = useState<DrawerFilter>("all");
  const [drawerWarehouse, setDrawerWarehouse] = useState("-");
  const [repairState, setRepairState] = useState<RepairState | null>(null);
  const [repairSelection, setRepairSelection] = useState("");
  const [importFeedback, setImportFeedback] = useState<{ type: "success" | "warning"; text: string } | null>(null);
  const [absentBannerDismissed, setAbsentBannerDismissed] = useState(false);

  const nameOptions = useMemo(
    () => (usersQuery.data ?? []).map((user) => user.name).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [usersQuery.data]
  );

  // Names already assigned in any pair except the one currently being edited
  const pairedNamesExcludingEdit = useMemo(() => {
    const names = new Set<string>();
    pairs.forEach((pair) => {
      if (pair.id === editingPairId) return;
      [pair.counter, pair.checker, pair.counter2].forEach((name) => {
        if (name) names.add(normalizeName(name));
      });
    });
    return names;
  }, [pairs, editingPairId]);
  const warehouseOptions = useMemo(() => {
    if (isRecount && allBins.length > 0) return allBins;
    const options = Array.from(new Set(items.map((item) => item.warehouse).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return options.length > 0 ? options : ["-"];
  }, [isRecount, allBins, items]);

  const attendeeByName = useMemo(() => {
    const next = new Map<string, { attended: boolean; name: string }>();
    attendees.forEach((attendee) => {
      next.set(normalizeName(attendee.name), { attended: attendee.attended, name: attendee.name });
    });
    return next;
  }, [attendees]);

  useEffect(() => {
    void importBins.mutateAsync({}).catch((error) => {
      setImportFeedback({
        type: "warning",
        text: (error as Error).message || "Failed to refresh bins."
      });
    });
    // Run once per tab mount/session to mimic legacy pair-tab entry refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const pairProgress = useMemo(() => {
    const next = new Map<string, number>();
    pairs.forEach((pair) => {
      const assigned = items.filter((item) => item.assignedPair === pair.id && !item.dropped);
      const counted = assigned.filter((item) => item.countQty !== null).length;
      const progress = assigned.length > 0 ? Math.round((counted / assigned.length) * 100) : 0;
      next.set(pair.id, progress);
    });
    return next;
  }, [items, pairs]);

  const isMemberAbsent = (name: string | undefined) => {
    if (!name || attendees.length === 0) return false;
    const found = attendeeByName.get(normalizeName(name));
    if (!found) return true;
    return !found.attended;
  };

  const absentNames = useMemo(() => attendees.filter((row) => !row.attended).map((row) => row.name), [attendees]);
  const missingAttendanceNames = useMemo(() => {
    if (attendees.length === 0) return [];
    const names = new Set<string>();
    pairs.forEach((pair) => {
      [pair.counter, pair.checker, pair.counter2].forEach((member) => {
        if (!member) return;
        if (!attendeeByName.get(normalizeName(member))) names.add(member);
      });
    });
    return Array.from(names);
  }, [attendeeByName, attendees.length, pairs]);

  const absentLinkedCount = useMemo(() => {
    if (attendees.length === 0) return 0;
    return pairs.filter((pair) => {
      return [pair.counter, pair.checker, pair.counter2].some((member) => {
        if (!member) return false;
        const found = attendeeByName.get(normalizeName(member));
        if (!found) return true;
        return !found.attended;
      });
    }).length;
  }, [attendeeByName, attendees.length, pairs]);

  useEffect(() => { setAbsentBannerDismissed(false); }, [absentLinkedCount, missingAttendanceNames.length]);

  const visiblePairs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pairs;
    return pairs.filter(
      (pair) =>
        pair.id.toLowerCase().includes(query) ||
        pair.counter.toLowerCase().includes(query) ||
        pair.checker.toLowerCase().includes(query) ||
        (pair.counter2 ?? "").toLowerCase().includes(query) ||
        pair.warehouse.toLowerCase().includes(query)
    );
  }, [pairs, search]);

  const drawerPair = drawerPairId ? pairs.find((pair) => pair.id === drawerPairId) ?? null : null;
  const repairPair = repairState ? pairs.find((pair) => pair.id === repairState.pairId) ?? null : null;

  const replacementCandidates = useMemo(() => {
    if (!repairState || !repairPair) return [];
    const existingMembers = new Set(
      [repairPair.counter, repairPair.checker, repairPair.counter2]
        .filter((value): value is string => Boolean(value))
        .map((value) => normalizeName(value))
    );
    const targetNameNormalized = normalizeName(repairState.targetName);
    const otherPairedNames = new Set<string>();
    pairs.forEach((pair) => {
      if (pair.id === repairState.pairId) return;
      [pair.counter, pair.checker, pair.counter2].forEach((name) => {
        if (name) otherPairedNames.add(normalizeName(name));
      });
    });

    return (usersQuery.data ?? [])
      .filter((user) => {
        const normalized = normalizeName(user.name);
        if (normalized === targetNameNormalized) return false;
        if (existingMembers.has(normalized)) return false;
        if (otherPairedNames.has(normalized)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [repairPair, repairState, usersQuery.data, pairs]);

  const drawerItems = useMemo(() => {
    if (!drawerPair) return [];
    const query = drawerSearch.trim().toLowerCase();
    return items.filter((item) => {
      if (item.assignedPair !== drawerPair.id) return false;
      if (drawerFilter === "active" && item.dropped) return false;
      if (drawerFilter === "dropped" && !item.dropped) return false;
      if (query.length > 0 && !item.code.toLowerCase().includes(query) && !item.name.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [drawerFilter, drawerPair, drawerSearch, items]);

  const getRepairTarget = (pair: PairAssignment): { key: RepairTargetKey; label: string; name: string } | null => {
    if (attendees.length === 0) return null;
    const members: Array<{ key: RepairTargetKey; label: string; name?: string }> = [
      { key: "counter", label: "counter", name: pair.counter },
      { key: "checker", label: "checker", name: pair.checker },
      { key: "counter2", label: "counter 2", name: pair.counter2 }
    ];

    for (const member of members) {
      if (!member.name) continue;
      if (isMemberAbsent(member.name)) {
        return {
          key: member.key,
          label: member.label,
          name: member.name
        };
      }
    }

    return null;
  };

  const drawerRepairTarget = drawerPair ? getRepairTarget(drawerPair) : null;

  const openCreate = () => {
    setEditingPairId(null);
    setDraft((previous) => ({
      ...emptyDraft,
      warehouse: previous.warehouse !== "-" ? previous.warehouse : warehouseOptions[0] ?? "-"
    }));
    setShowForm(true);
  };

  const openEdit = (pair: PairAssignment) => {
    setShowForm(true);
    setEditingPairId(pair.id);
    setDraft({
      counter: pair.counter,
      checker: pair.checker,
      counter2: pair.counter2 ?? "",
      warehouse: pair.warehouse,
      role: pair.role
    });
  };

  const openDrawer = (pairId: string) => {
    const pair = pairs.find((entry) => entry.id === pairId);
    if (!pair) return;
    setDrawerPairId(pairId);
    setDrawerSearch("");
    setDrawerFilter("all");
    setDrawerWarehouse(pair.warehouse || "-");
  };

  const saveDraft = async () => {
    if (!draft.counter.trim() || !draft.checker.trim()) return;
    const payload: PairDraft = {
      counter: draft.counter.trim(),
      checker: draft.checker.trim(),
      counter2: draft.counter2?.trim() || undefined,
      warehouse: draft.warehouse?.trim() || warehouseOptions[0] || "-",
      role: draft.role
    };

    if (editingPairId) {
      await updatePair.mutateAsync({
        pairId: editingPairId,
        input: payload
      });
    } else {
      await createPair.mutateAsync(payload);
    }

    setEditingPairId(null);
    setDraft({
      ...emptyDraft,
      warehouse: warehouseOptions[0] ?? "-"
    });
    setShowForm(false);
  };

  const handleImportUsers = async () => {
    const confirmed = window.confirm(
      "This will erase all existing users and reset all pair assignments. Attendance records for this session will also be cleared.\n\nProceed?"
    );
    if (!confirmed) return;

    try {
      const result = await importUsers.mutateAsync({
        sessionId,
        resetSessionAssignments: true
      });
      const resetSummary = result.reset
        ? ` Reset ${result.reset.pairsDeleted} pair(s), ${result.reset.attendanceDeleted} attendance row(s), and unassigned ${result.reset.itemsUnassigned} item(s).`
        : "";
      setImportFeedback({
        type: "success",
        text: `Imported ${result.imported} user(s).${resetSummary}`
      });
      await usersQuery.refetch();
    } catch (error) {
      setImportFeedback({
        type: "warning",
        text: (error as Error).message || "User import failed."
      });
    }
  };

  const saveDrawerBins = async () => {
    if (!drawerPair) return;
    try {
      await updatePair.mutateAsync({
        pairId: drawerPair.id,
        input: {
          counter: drawerPair.counter,
          checker: drawerPair.checker,
          counter2: drawerPair.counter2,
          warehouse: drawerWarehouse.trim() || "-",
          role: drawerPair.role
        }
      });
      setImportFeedback({
        type: "success",
        text: `Updated bins for ${drawerPair.id}.`
      });
      setDrawerPairId(null);
      setDrawerWarehouse("-");
    } catch (error) {
      setImportFeedback({
        type: "warning",
        text: (error as Error).message || "Failed to update bins."
      });
    }
  };

  const openRepair = () => {
    if (!drawerPair) return;
    const target = getRepairTarget(drawerPair);
    if (!target) {
      setImportFeedback({
        type: "warning",
        text: "No absent member in this pair to replace."
      });
      return;
    }
    setRepairState({
      pairId: drawerPair.id,
      targetKey: target.key,
      targetLabel: target.label,
      targetName: target.name
    });
    setRepairSelection("");
  };

  const confirmRepair = async () => {
    if (!repairState || !repairPair || !repairSelection) return;
    const payload: PairDraft = {
      counter: repairPair.counter,
      checker: repairPair.checker,
      counter2: repairPair.counter2,
      warehouse: repairPair.warehouse,
      role: repairPair.role
    };

    if (repairState.targetKey === "counter") {
      payload.counter = repairSelection;
    } else if (repairState.targetKey === "checker") {
      payload.checker = repairSelection;
    } else {
      payload.counter2 = repairSelection;
    }

    try {
      await updatePair.mutateAsync({
        pairId: repairPair.id,
        input: payload
      });
      setRepairState(null);
      setRepairSelection("");
      setImportFeedback({
        type: "success",
        text: `Replaced ${repairState.targetLabel} in ${repairPair.id}.`
      });
    } catch (error) {
      setImportFeedback({
        type: "warning",
        text: (error as Error).message || "Failed to replace absent member."
      });
    }
  };

  return (
    <section className="panel">
      <div className="tab-header-row">
        <div>
          <h3>Pair Assignment</h3>
          <p>Create and review counter/checker assignments.</p>
        </div>
        <div className="tab-actions">
          <button type="button" disabled={importUsers.isPending} onClick={() => void handleImportUsers()}>
            {importUsers.isPending ? "Importing..." : "Import users"}
          </button>
          <button type="button" className="primary-btn" onClick={openCreate}>
            + Add pair
          </button>
        </div>
      </div>
      {importFeedback ? (
        <BannerModal
          type={importFeedback.type}
          message={importFeedback.text}
          onClose={() => setImportFeedback(null)}
        />
      ) : null}

      <div className="pair-search-wrap">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name..."
          aria-label="Search pairs"
          className="pair-search-input"
        />
      </div>

      <div id="strict-roles-toggle" className="strict-roles-wrap">
        <div className="strict-roles-row">
          <span className="strict-roles-label">Role mode:</span>
          <button
            type="button"
            className={strictRoles ? "primary-btn strict-roles-btn" : "strict-roles-btn"}
            onClick={() => void onToggleStrictRoles()}
          >
            {strictRoles ? "Strict Roles" : "Interchangeable"}
          </button>
          <span className="strict-roles-help">
            {strictRoles ? "Counter scans / Checker approves" : "Counter and checker can both scan"}
          </span>
        </div>
      </div>

      {(absentLinkedCount > 0 || missingAttendanceNames.length > 0) && attendees.length > 0 && !absentBannerDismissed ? (
        <div className="inline-alert inline-alert-warning">
          <span>
            {missingAttendanceNames.length > 0
              ? `Warning: ${missingAttendanceNames.length} pair member(s) not in attendance list (marked absent): ${missingAttendanceNames.join(", ")}`
              : `Absent member alert: ${absentLinkedCount} pair(s) include attendees marked absent.`}
          </span>
          <button type="button" className="ghost-btn" onClick={() => setAbsentBannerDismissed(true)}>×</button>
        </div>
      ) : null}

      {absentNames.length > 0 ? (
        <div className="inline-summary pair-absent-summary">
          <span>Absent list: {absentNames.join(", ")}</span>
        </div>
      ) : null}

      {isLoading ? <p>Loading pairs...</p> : null}
      <div className="pair-grid">
        {visiblePairs.map((pair, index) => {
          const counterAbsent = isMemberAbsent(pair.counter);
          const checkerAbsent = isMemberAbsent(pair.checker);
          const counter2Absent = isMemberAbsent(pair.counter2);
          const hasAbsent = counterAbsent || checkerAbsent || counter2Absent;
          const progress = pairProgress.get(pair.id) ?? 0;

          return (
            <article
              key={pair.id}
              className={`pcard ${hasAbsent ? "absent-border" : ""}`}
              onClick={() => {
                if (isRecount) openDrawer(pair.id);
                else openEdit(pair);
              }}
            >
              <div className="pair-index">Pair {index + 1}</div>
              <div className="pair-code">{pair.id}</div>

              <div className="pair-members">
                <div className="pair-member-row">
                  <div className={`av ${counterAbsent ? "av-a" : "av-n"}`}>{initials(pair.counter)}</div>
                  <div className="pair-member-meta">
                    <div className={`pname ${counterAbsent ? "abs" : ""}`}>
                      <span className="pname-text" title={pair.counter}>
                        {pair.counter}
                      </span>
                      {counterAbsent ? <span className="abs-tag">Absent</span> : null}
                    </div>
                    <div className="pair-member-role">Counter</div>
                  </div>
                </div>
                <div className="pair-member-row">
                  <div className={`av ${checkerAbsent ? "av-a" : "av-n"}`}>{initials(pair.checker)}</div>
                  <div className="pair-member-meta">
                    <div className={`pname ${checkerAbsent ? "abs" : ""}`}>
                      <span className="pname-text" title={pair.checker}>
                        {pair.checker}
                      </span>
                      {checkerAbsent ? <span className="abs-tag">Absent</span> : null}
                    </div>
                    <div className="pair-member-role">Checker</div>
                  </div>
                </div>
                {pair.counter2 ? (
                  <div className="pair-member-row">
                    <div className={`av ${counter2Absent ? "av-a" : "av-n"}`}>{initials(pair.counter2)}</div>
                    <div className="pair-member-meta">
                      <div className={`pname ${counter2Absent ? "abs" : ""}`}>
                        <span className="pname-text" title={pair.counter2}>
                          {pair.counter2}
                        </span>
                        {counter2Absent ? <span className="abs-tag">Absent</span> : null}
                      </div>
                      <div className="pair-member-role">Counter 2</div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="pair-footer">
                <div className="pair-meta-row">
                  <span className="pair-meta-label">Role:</span>
                  <span className={`role-badge ${pair.role === "Admin" ? "role-admin" : "role-user"}`}>{pair.role}</span>
                </div>
                {isRecount ? (
                  <div className="pair-meta-row">
                    <span className="pair-meta-label">Bin: </span>
                    <span className="pair-bin-value" title={pair.warehouse || "-"}>
                      {pair.warehouse || "-"}
                    </span>
                  </div>
                ) : null}
                {isRecount ? (
                  <div className="pair-progress-row">
                    <div className="pair-progress-group">
                      <div className="prog-bar">
                        <div className="prog-fill" style={{ width: `${progress}%`, background: progress > 85 ? "#1D9E75" : undefined }} />
                      </div>
                      <span className="pair-progress-pct">{progress}%</span>
                    </div>
                  </div>
                ) : null}
                <div className="pair-action-row">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEdit(pair);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async (event) => {
                      event.stopPropagation();
                      const ok = window.confirm(`Delete pair ${pair.id}?`);
                      if (!ok) return;
                      await deletePair.mutateAsync(pair.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        <article className="pcard pcard-add-tile" onClick={openCreate}>
          <div className="pcard-add-icon">+</div>
          <div className="pcard-add-label">Add pair</div>
        </article>
      </div>

      {showForm ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={editingPairId ? "Edit Pair" : "New Pair"}>
          <section className="modal" style={{ width: "70vw", maxWidth: "70vw" }}>
            <header>
              <h2>{editingPairId ? "Edit Pair" : "New Pair"}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="ghost-btn">
                X
              </button>
            </header>

            <div className={`inline-form ${isRecount ? "three-cols" : ""} pair-inline-row`}>
              <label>
                Counter
                <select
                  value={draft.counter}
                  onChange={(event) => setDraft((previous) => ({ ...previous, counter: event.target.value }))}
                >
                  <option value="">Select...</option>
                  {getAvailableOptions(nameOptions, pairedNamesExcludingEdit, draft.counter, [draft.checker, draft.counter2]).map((name) => (
                    <option key={`counter-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Checker
                <select
                  value={draft.checker}
                  onChange={(event) => setDraft((previous) => ({ ...previous, checker: event.target.value }))}
                >
                  <option value="">Select...</option>
                  {getAvailableOptions(nameOptions, pairedNamesExcludingEdit, draft.checker, [draft.counter, draft.counter2]).map((name) => (
                    <option key={`checker-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {isRecount ? (
                <label>
                  Role
                  <select
                    value={draft.role}
                    onChange={(event) => setDraft((previous) => ({ ...previous, role: event.target.value as "Admin" | "User" }))}
                  >
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                  </select>
                </label>
              ) : null}
            </div>

            <div className="inline-form pair-inline-row">
              <label>
                Counter 2 <span className="pair-optional">(optional)</span>
                <select
                  value={draft.counter2 ?? ""}
                  onChange={(event) => setDraft((previous) => ({ ...previous, counter2: event.target.value || undefined }))}
                >
                  <option value="">(none)</option>
                  {getAvailableOptions(nameOptions, pairedNamesExcludingEdit, draft.counter2 ?? "", [draft.counter, draft.checker]).map((name) => (
                    <option key={`counter2-${name}`} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {isRecount ? (
                <label>
                  Warehouse bins
                  <select
                    multiple
                    value={splitBins(draft.warehouse)}
                    onChange={(event) => {
                      const selected = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                      setDraft((previous) => ({ ...previous, warehouse: selected.join(",") || "-" }));
                    }}
                  >
                    {warehouseOptions.map((warehouse) => (
                      <option key={warehouse} value={warehouse}>
                        {warehouse}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <footer>
              <button type="button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button onClick={() => void saveDraft()} disabled={createPair.isPending || updatePair.isPending} className="primary-btn">
                {createPair.isPending || updatePair.isPending ? "Saving..." : "Save Pair"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {drawerPair ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Recount Pair Drawer">
          <section className="modal drawer-modal" style={{ width: "70vw", maxWidth: "70vw", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <header>
              <h2>
                Items - {drawerPair.counter} / {drawerPair.checker}
                {drawerPair.counter2 ? ` / ${drawerPair.counter2}` : ""}
              </h2>
              <button type="button" onClick={() => setDrawerPairId(null)} className="ghost-btn">
                X
              </button>
            </header>
            <div className="inline-summary pair-drawer-summary">
              <span>{drawerPair.id}</span>
              <span>Role: {drawerPair.role}</span>
              <span>
                {drawerItems.length} item{drawerItems.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="pair-drawer-toolbar">
              <input
                value={drawerSearch}
                onChange={(event) => setDrawerSearch(event.target.value)}
                placeholder="Search items by code or name..."
                aria-label="Search drawer items"
              />
              <select value={drawerFilter} onChange={(event) => setDrawerFilter(event.target.value as DrawerFilter)}>
                <option value="all">All items</option>
                <option value="active">Active</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>
            <label>
              Recount bins
              <select
                ref={drawerSelectRef}
                multiple
                value={splitBins(drawerWarehouse || drawerPair.warehouse)}
                style={{ resize: "vertical", minHeight: 120, height: 180 }}
                onChange={(event) => {
                  const selected = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                  setDrawerWarehouse(selected.join(",") || "-");
                }}
                onClick={(event) => {
                  // Shift+click multiselect: handled natively by the browser for <select multiple>
                  const el = event.currentTarget;
                  const selected = Array.from(el.selectedOptions).map((option) => option.value);
                  setDrawerWarehouse(selected.join(",") || "-");
                }}
              >
                {(allBins.length > 0 ? allBins : warehouseOptions).map((bin) => (
                  <option key={bin} value={bin}>
                    {bin}
                  </option>
                ))}
              </select>
            </label>
            <div className="pair-drawer-table-wrap">
              <table className="legacy-table compact">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Group</th>
                    <th>Batch</th>
                    <th>UoM</th>
                    <th>Bin</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="db-empty-cell">
                        No items
                      </td>
                    </tr>
                  ) : (
                    drawerItems.map((item) => (
                      <tr key={item.id} className={item.dropped ? "row-dropped" : ""}>
                        <td>{item.code}</td>
                        <td>{item.name}</td>
                        <td>{item.group || "-"}</td>
                        <td>{item.batch || "-"}</td>
                        <td>{item.uom || "-"}</td>
                        <td>{item.warehouse || "-"}</td>
                        <td>
                          <span className={`badge ${item.dropped ? "is-drop" : "is-active"}`}>
                            {item.dropped ? "Dropped" : "Active"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <footer>
              <div className="pair-drawer-actions">
                <button
                  type="button"
                  onClick={() => {
                    openEdit(drawerPair);
                    setDrawerPairId(null);
                  }}
                >
                  Edit pair
                </button>
                {drawerRepairTarget ? (
                  <button type="button" onClick={openRepair}>
                    Replace absent member
                  </button>
                ) : null}
              </div>
              <div className="pair-drawer-actions">
                <button type="button" onClick={() => setDrawerPairId(null)}>
                  Close
                </button>
                <button type="button" className="primary-btn" disabled={updatePair.isPending} onClick={() => void saveDrawerBins()}>
                  {updatePair.isPending ? "Saving..." : "Save bins"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}

      {repairState && repairPair ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Repair Pair">
          <section className="modal">
            <header>
              <h2>
                Replace {repairState.targetLabel} - Pair {repairPair.id}
              </h2>
              <button type="button" onClick={() => setRepairState(null)} className="ghost-btn">
                X
              </button>
            </header>
            <p className="muted">
              {repairState.targetName} is absent. Select a replacement from the user list.
            </p>
            <div className="repair-option-list">
              {replacementCandidates.length === 0 ? (
                <div className="repair-empty-msg">No users available. Import users first.</div>
              ) : (
                replacementCandidates.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className={`repair-option-btn ${repairSelection === user.name ? "selected" : ""}`}
                    onClick={() => setRepairSelection(user.name)}
                  >
                    <span className="av av-n">{initials(user.name)}</span>
                    <span className="repair-option-meta">
                      <span className="repair-option-name">{user.name}</span>
                      <span className="repair-option-sub">Available</span>
                    </span>
                  </button>
                ))
              )}
            </div>
            <footer>
              <button type="button" onClick={() => setRepairState(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                disabled={!repairSelection || updatePair.isPending}
                onClick={() => void confirmRepair()}
              >
                {updatePair.isPending ? "Saving..." : "Confirm Replacement"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
