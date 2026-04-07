import type { WarehouseItem } from "../../types/domain";

interface WarehouseGalleryProps {
  title: string;
  items: WarehouseItem[];
  loading: boolean;
  selectedItemId?: string | null;
  onSelectItem?: (item: WarehouseItem) => void;
}

export function WarehouseGallery({ title, items, loading, selectedItemId, onSelectItem }: WarehouseGalleryProps) {
  return (
    <section className="panel">
      <div className="cv-gallery-label">{title}</div>
      {loading ? <p>Loading items...</p> : null}

      {items.length === 0 && !loading ? (
        <div id="cv-empty" className="cv-empty">
          <div className="cv-empty-msg">No items matched your search.</div>
        </div>
      ) : null}

      <div className="cv-result-grid">
        {items.map((item) => {
          const counted = item.countQty !== null;
          return (
            <article
              key={item.id}
              className={`cv-item-card ${selectedItemId === item.id ? "cv-item-card-active" : ""} ${onSelectItem ? "cv-item-card-clickable" : ""}`}
              role={onSelectItem ? "button" : undefined}
              tabIndex={onSelectItem ? 0 : undefined}
              onClick={onSelectItem ? () => onSelectItem(item) : undefined}
              onKeyDown={
                onSelectItem
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectItem(item);
                      }
                    }
                  : undefined
              }
            >
              <div className="cv-item-primary">
                <span className="cv-item-code-tag" title={item.code}>
                  {item.code}
                </span>
                <span className="cv-item-batch-tag" title={item.warehouse}>
                  {item.warehouse}
                </span>
              </div>
              <div className="cv-item-name" title={item.name}>
                {item.name}
              </div>
              <div className="cv-item-meta">
                {item.warehouse || ""}
                {item.assignedTo ? ` - Assigned: ${item.assignedTo}` : ""}
              </div>
              {counted ? <div className="cv-item-counted">Counted: {item.countQty}</div> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
