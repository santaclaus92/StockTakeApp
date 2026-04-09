import { useEffect, useState } from "react";
import { useNewItemsQuery, useUpdateNewItemStatusMutation } from "../../../hooks/useAdminData";
import { BannerModal } from "../../ui/BannerModal";

interface NewItemGalleryTabProps {
  sessionId: string;
}

export function NewItemGalleryTab({ sessionId }: NewItemGalleryTabProps) {
  const { data = [], isLoading, isError, error, refetch } = useNewItemsQuery(sessionId);
  const updateStatus = useUpdateNewItemStatusMutation(sessionId);
  const [photoLightbox, setPhotoLightbox] = useState<string | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);
  useEffect(() => { setErrorDismissed(false); }, [isError]);

  return (
    <section className="panel">
      <div className="tab-header-row">
        <div>
          <h3>New Item</h3>
          <p>Items submitted by staff that were not found in SAP.</p>
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

      <div className="grid">
        {data.map((item) => {
          const isResolved = item.status === "Approved";
          return (
            <article key={item.id} className="card">
              {item.photos?.[0] ? (
                <img
                  src={item.photos[0]}
                  alt={`${item.code} photo`}
                  className="new-item-photo"
                  onClick={() => setPhotoLightbox(item.photos?.[0] ?? null)}
                />
              ) : (
                <div className="new-item-photo-placeholder">No photo</div>
              )}
              <h4>
                {item.code} - {item.name}
              </h4>
              <p>Submitted by: {item.submittedBy || "-"}</p>
              <p>Bin Location: {item.warehouse || "-"}</p>
              <p>UOM: {item.uom || "-"}</p>
              <p>Serial / Batch: {item.batch || "-"}</p>
              <p>Qty: {item.qty ?? "-"}</p>
              <p>
                Damaged / Expired: {item.damagedQty ?? "-"} / {item.expiredQty ?? "-"}
              </p>
              <p>Remark: {item.remark || "-"}</p>
              <p>Created: {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</p>
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className={isResolved ? "btn btn-sm btn-success" : "btn btn-sm"}
                  disabled={updateStatus.isPending}
                  onClick={() =>
                    updateStatus.mutate({ itemId: item.id, status: isResolved ? "Pending" : "Approved" })
                  }
                >
                  {isResolved ? "Resolved" : "Unresolved"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {photoLightbox ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="New Item Photo">
          <section className="modal">
            <header>
              <h2>New Item Photo</h2>
              <button type="button" onClick={() => setPhotoLightbox(null)} className="ghost-btn">
                X
              </button>
            </header>
            <img src={photoLightbox} alt="New item full view" className="new-item-photo-full" />
          </section>
        </div>
      ) : null}
    </section>
  );
}
