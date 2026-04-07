import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useAttendanceQuery, usePairsQuery, useToggleAttendanceMutation, useUpsertAttendanceMutation, useUsersQuery } from "../../../hooks/useAdminData";
import type { AttendanceRecord } from "../../../types/domain";

interface AttendanceTabProps {
  sessionId: string;
}

type AttendanceTimeField = "checkIn" | "lunchOut" | "lunchIn" | "checkOut";

const TIME_FIELDS: Array<{ key: AttendanceTimeField; label: string }> = [
  { key: "checkIn", label: "Check In" },
  { key: "lunchOut", label: "Lunch Out" },
  { key: "lunchIn", label: "Lunch In" },
  { key: "checkOut", label: "Check Out" }
];

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((chunk) => chunk[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function toTimeInputValue(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function toIsoWithTime(baseIso: string | undefined, timeValue: string): string | undefined {
  if (!timeValue) return undefined;
  const base = baseIso ? new Date(baseIso) : new Date();
  const [hours, minutes] = timeValue.split(":").map((value) => Number(value));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;
  base.setHours(hours, minutes, 0, 0);
  return base.toISOString();
}

function toAttendeeTimes(attendee: AttendanceRecord): Record<AttendanceTimeField, string | undefined> {
  return {
    checkIn: attendee.checkIn,
    lunchOut: attendee.lunchOut,
    lunchIn: attendee.lunchIn,
    checkOut: attendee.checkOut
  };
}

export function AttendanceTab({ sessionId }: AttendanceTabProps) {
  const { data: attendees = [], isLoading, refetch } = useAttendanceQuery(sessionId);
  const { data: pairs = [] } = usePairsQuery(sessionId);
  const usersQuery = useUsersQuery();
  const toggleAttendance = useToggleAttendanceMutation(sessionId);
  const upsertAttendance = useUpsertAttendanceMutation(sessionId);

  const [manualUserId, setManualUserId] = useState("");
  const [manualMessage, setManualMessage] = useState("");
  const [qrTick, setQrTick] = useState(Date.now());
  const [qrExpiresAt, setQrExpiresAt] = useState(Date.now() + 60_000);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [timeDrafts, setTimeDrafts] = useState<Record<string, Partial<Record<AttendanceTimeField, string>>>>({});

  useEffect(() => {
    const timer = setInterval(() => setQrTick(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (qrTick < qrExpiresAt) return;
    setQrExpiresAt(Date.now() + 60_000);
  }, [qrExpiresAt, qrTick]);

  const secondsLeft = Math.max(0, Math.ceil((qrExpiresAt - qrTick) / 1000));
  const qrToken = useMemo(() => `att:${sessionId}:${Math.floor(qrExpiresAt / 60_000)}`, [qrExpiresAt, sessionId]);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(qrToken, {
      width: 200,
      margin: 1,
      color: { dark: "#2C3E50", light: "#ffffff" }
    })
      .then((next) => {
        if (!cancelled) setQrDataUrl(next);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [qrToken]);

  const present = attendees.filter((attendee) => attendee.attended).length;
  const absent = attendees.length - present;

  const pairNumberByMember = useMemo(() => {
    const next = new Map<string, number>();
    pairs.forEach((pair, index) => {
      const pairNo = index + 1;
      [pair.counter, pair.checker, pair.counter2].forEach((member) => {
        if (!member) return;
        next.set(normalizeName(member), pairNo);
      });
    });
    return next;
  }, [pairs]);

  const attendeeUserIds = useMemo(() => new Set(attendees.map((attendee) => attendee.userId)), [attendees]);
  const addableUsers = useMemo(
    () => (usersQuery.data ?? []).filter((user) => !attendeeUserIds.has(user.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [attendeeUserIds, usersQuery.data]
  );

  return (
    <section className="panel">
      <div className="tab-header-row">
        <div>
          <h3>Attendance</h3>
          <p>Track attendance, generate QR token, and edit check-in time.</p>
        </div>
        <div className="tab-actions" style={{ display: "none" }}>
          <button type="button" onClick={() => void refetch()}>
            Refresh
          </button>
          <button type="button" onClick={() => setQrExpiresAt(Date.now() + 60_000)}>
            Regenerate QR
          </button>
        </div>
      </div>

      <div className="card att-qr-card">
        <div className="att-qr-title">Attendance QR Code</div>
        <div className="att-qr-sub">Users can scan this code to mark attendance.</div>
        <div className="att-qr-canvas-wrap">
          {qrDataUrl ? (
            <img className="att-qr-img" src={qrDataUrl} alt={`Attendance QR for ${sessionId}`} />
          ) : (
            <code className="att-qr-token">{qrToken}</code>
          )}
        </div>
        <div className="att-qr-countdown">
          Refreshes in <span className="att-qr-count">{secondsLeft}s</span>
        </div>
      </div>

      <div className="card att-add-card">
        <div className="att-add-title">Add Attendee</div>
        <div className="att-add-row">
          <select
            value={manualUserId}
            onChange={(event) => {
              setManualUserId(event.target.value);
              setManualMessage("");
            }}
            className="att-add-select"
            aria-label="Select attendee"
          >
            <option value="">Select user...</option>
            {addableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="primary-btn"
            disabled={!manualUserId || upsertAttendance.isPending}
            onClick={async () => {
              const selectedUser = (usersQuery.data ?? []).find((user) => user.id === manualUserId);
              if (!selectedUser) return;
              await upsertAttendance.mutateAsync({
                userId: selectedUser.id,
                name: selectedUser.name,
                attended: true,
                checkIn: new Date().toISOString()
              });
              setManualUserId("");
              setManualMessage(`${selectedUser.name} added to attendance.`);
            }}
          >
            + Add
          </button>
        </div>
        {manualMessage ? <div className="att-add-msg">{manualMessage}</div> : null}
      </div>

      <div className="att-head">
        <div>
          <div className="att-head-title">Attendance</div>
          <div className="att-head-sub">
            {attendees.length} users - {absent ? `${absent} absent` : `all present`} (Present: {present})
          </div>
        </div>
      </div>

      {isLoading ? <div className="banner">Loading attendance...</div> : null}

      <div id="attendance-list" className="card att-list-card">
        {attendees.length === 0 ? (
          <div className="att-empty">
            No attendees yet. Users can scan the QR token above, or add them manually.
          </div>
        ) : (
          <div className="att-grid">
            {attendees.map((attendee) => {
              const memberKey = normalizeName(attendee.name);
              const pairNo = pairNumberByMember.get(memberKey);
              const absentClass = attendee.attended ? "" : " absent";
              const statusClass = attendee.attended ? "present" : "absent";

              return (
                <div
                  key={attendee.userId}
                  className={`att-card${absentClass}`}
                  onClick={() => toggleAttendance.mutate(attendee.userId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") toggleAttendance.mutate(attendee.userId);
                  }}
                >
                  <div className="att-card-left">
                    <div className="att-av">{initials(attendee.name)}</div>
                    <div className="att-name" title={attendee.name}>
                      {attendee.name}
                    </div>
                    {pairNo ? (
                      <span className="att-pair-pill">P{pairNo}</span>
                    ) : null}
                    <span className={`att-status ${statusClass}`}>{attendee.attended ? "Present" : "Absent"}</span>
                  </div>
                  <div className="att-times">
                    {TIME_FIELDS.map((field) => {
                      const currentValue = toAttendeeTimes(attendee)[field.key];
                      const draftValue = timeDrafts[attendee.userId]?.[field.key] ?? toTimeInputValue(currentValue);

                      return (
                        <label key={field.key} className="att-time-row att-time-edit">
                          <span className="att-time-lbl">{field.label}</span>
                          <input
                            className="att-time-input"
                            type="time"
                            value={draftValue}
                            onClick={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setTimeDrafts((previous) => ({
                                ...previous,
                                [attendee.userId]: {
                                  ...(previous[attendee.userId] ?? {}),
                                  [field.key]: event.target.value
                                }
                              }))
                            }
                            onBlur={() => {
                              const rowDraft = timeDrafts[attendee.userId];
                              const nextValue = rowDraft?.[field.key] ?? "";
                              const updatedIso = toIsoWithTime(currentValue, nextValue);
                              const currentIso = currentValue ?? undefined;
                              if (updatedIso === currentIso) return;

                              const nextTimes = {
                                ...toAttendeeTimes(attendee),
                                [field.key]: updatedIso
                              };

                              void upsertAttendance.mutateAsync({
                                userId: attendee.userId,
                                name: attendee.name,
                                attended: attendee.attended,
                                checkIn: nextTimes.checkIn,
                                lunchOut: nextTimes.lunchOut,
                                lunchIn: nextTimes.lunchIn,
                                checkOut: nextTimes.checkOut
                              });
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
