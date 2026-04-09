import { useEffect, useMemo, useState } from "react";
import { useApprovalsQuery, useReviewApprovalMutation } from "../../../hooks/useAdminData";
import { BannerModal } from "../../ui/BannerModal";

interface ApprovalTabProps {
  sessionId: string;
}

function renderBin(value?: string | null): string {
  if (!value) return "-";
  return value.trim() || "-";
}

export function ApprovalTab({ sessionId }: ApprovalTabProps) {
  const { data = [], isLoading, isError, error, refetch } = useApprovalsQuery(sessionId);
  const reviewMutation = useReviewApprovalMutation(sessionId);

  const pendingRows = useMemo(() => data.filter((approval) => approval.status === "Pending"), [data]);
  const reviewedRows = useMemo(() => data.filter((approval) => approval.status !== "Pending"), [data]);

  const [errorDismissed, setErrorDismissed] = useState(false);
  useEffect(() => { setErrorDismissed(false); }, [isError]);

  return (
    <section className="panel">
      <div className="tab-header-row">
        <div>
          <h3>Pending Approval</h3>
          <p>Qty/bin adjustments submitted by staff awaiting admin review.</p>
        </div>
        <div className="tab-actions">
          <button type="button" onClick={() => void refetch()}>
            Refresh
          </button>
        </div>
      </div>

      {isError && !errorDismissed ? (
        <BannerModal type="warning" message={(error as Error).message} onClose={() => setErrorDismissed(true)} />
      ) : null}

      <table className="legacy-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>Submitted By</th>
            <th>Old Qty</th>
            <th>New Qty</th>
            <th>Old Bin</th>
            <th>New Bin</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {pendingRows.map((approval) => (
            <tr key={approval.id}>
              <td>{approval.createdAt ? new Date(approval.createdAt).toLocaleString() : "-"}</td>
              <td>{approval.itemCode}</td>
              <td>{approval.itemName}</td>
              <td>{approval.submittedBy}</td>
              <td>{approval.oldQty}</td>
              <td className="approval-new-val">{approval.newQty}</td>
              <td>{renderBin(approval.oldBin)}</td>
              <td className="approval-new-val">{renderBin(approval.newBin)}</td>
              <td>{approval.status}</td>
              <td>
                <div className="table-actions">
                  <button
                    type="button"
                    className="success-btn"
                    disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ approvalId: approval.id, status: "Approved" })}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="danger-btn"
                    disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({ approvalId: approval.id, status: "Rejected" })}
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {reviewedRows.length > 0 ? (
        <>
          <h4>Reviewed</h4>
          <table className="legacy-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Bin</th>
                <th>Status</th>
                <th>Reviewed By</th>
              </tr>
            </thead>
            <tbody>
              {reviewedRows.map((approval) => (
                <tr key={`reviewed-${approval.id}`}>
                  <td>{approval.createdAt ? new Date(approval.createdAt).toLocaleString() : "-"}</td>
                  <td>
                    {approval.itemCode} - {approval.itemName}
                  </td>
                  <td>
                    {approval.oldQty}
                    {" -> "}
                    {approval.newQty}
                  </td>
                  <td>
                    {renderBin(approval.oldBin)}
                    {" -> "}
                    {renderBin(approval.newBin)}
                  </td>
                  <td>{approval.status}</td>
                  <td>{approval.reviewedBy || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}

