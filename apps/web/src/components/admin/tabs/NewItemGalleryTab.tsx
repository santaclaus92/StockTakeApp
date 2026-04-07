import { useState } from "react";
import { useNewItemsQuery } from "../../../hooks/useAdminData";

interface NewItemGalleryTabProps {
  sessionId: string;
}

export function NewItemGalleryTab({ sessionId }: NewItemGalleryTabProps) {
  const { data = [], isLoading, isError, error, refetch } = useNewItemsQuery(sessionId);
  const [photoLightbox, setPhotoLightbox] = useState<string | null>(null);

  return (
    <section className="panel">
      <div className="tab-header-row">
        <div>
          <h3>New Item Gallery</h3>
          <p>Items submitted by staff that were not found in SAP.</p>
        </div>
        <div className="tab-actions">
          <button type="button" onClick={() => void refetch()}>
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? <div className="banner">Loading new items...</div> : null}
      {isError ? <div className="banner warning">{(error as Error).message}</div> : null}
      {!isLoading && !isError && data.length === 0 ? <div className="banner">No new items submitted yet.</div> : null}

      <div className="grid">
        {data.map((item) => (
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
            <p>Status: {item.status}</p>
            <p>Submitted by: {item.submittedBy || "-"}</p>
            <p>Warehouse: {item.warehouse || "-"}</p>
            <p>UOM: {item.uom || "-"}</p>
            <p>Serial / Batch: {item.batch || "-"}</p>
            <p>Qty: {item.qty ?? "-"}</p>
            <p>
              Damaged / Expired: {item.damagedQty ?? "-"} / {item.expiredQty ?? "-"}
            </p>
            <p>Remark: {item.remark || "-"}</p>
            <p>Created: {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</p>
          </article>
        ))}
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
