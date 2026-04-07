import { useAuditQuery } from "../../../hooks/useAdminData";

interface AuditTrailTabProps {
  sessionId: string;
}

export function AuditTrailTab({ sessionId }: AuditTrailTabProps) {
  const { data = [], isLoading, isError, error, refetch } = useAuditQuery(sessionId);

  return (
    <section className="panel">
      <div className="tab-header-row">
        <div>
          <h3>Audit Trail</h3>
          <p>Count submissions and approval updates with full item details.</p>
        </div>
        <div className="tab-actions">
          <button type="button" onClick={() => void refetch()}>
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? <div className="banner">Loading audit records...</div> : null}
      {isError ? <div className="banner warning">{(error as Error).message}</div> : null}
      {!isLoading && !isError && data.length === 0 ? (
        <div className="banner">No audit records yet. Records appear after count submissions.</div>
      ) : null}

      <table className="legacy-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>Submitted By</th>
            <th>Count Qty</th>
            <th>Damaged</th>
            <th>Expired</th>
            <th>Warehouse</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => {
            const isApprovalRemark = entry.remark?.toLowerCase().startsWith("approved by");
            return (
              <tr key={entry.id}>
                <td>{new Date(entry.countedAt).toLocaleString()}</td>
                <td>{entry.itemCode || "-"}</td>
                <td>{entry.itemName || "-"}</td>
                <td>{entry.submittedBy || "-"}</td>
                <td>{entry.qty ?? "-"}</td>
                <td>{entry.damagedQty ?? "-"}</td>
                <td>{entry.expiredQty ?? "-"}</td>
                <td>{entry.warehouse || "-"}</td>
                <td style={isApprovalRemark ? { color: "#1d4ed8", fontWeight: 600 } : undefined}>{entry.remark || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
