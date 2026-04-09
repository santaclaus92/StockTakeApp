import { useEffect, useMemo, useRef, useState } from "react";
import type { WarehouseItem } from "../../types/domain";
import { QuantityField } from "../ui/QuantityField";
import { uploadPhoto } from "../../services/photoUpload";
import { CameraScanner } from "./CameraScanner";

interface CountInputFormProps {
  items: WarehouseItem[];
  selectedItem?: WarehouseItem | null;
  onBack?: () => void;
  initialSubmittedBy?: string;
  isRecount?: boolean;
  firstCountQty?: number | null;
  binOptions?: string[];
  onSubmit: (input: {
    itemId: string;
    qty: number;
    submittedBy: string;
    damagedQty?: number | null;
    expiredQty?: number | null;
    remark?: string;
    photos?: string[];
    binLocation?: string;
  }) => Promise<void>;
}

export function CountInputForm({
  items,
  selectedItem = null,
  onBack,
  initialSubmittedBy = "Counter",
  isRecount = false,
  firstCountQty = null,
  binOptions = [],
  onSubmit
}: CountInputFormProps) {
  const [itemId, setItemId] = useState(selectedItem?.id ?? "");
  const [qty, setQty] = useState<number | null>(null);
  const [damagedQty, setDamagedQty] = useState<number | null>(null);
  const [expiredQty, setExpiredQty] = useState<number | null>(null);
  const [remark, setRemark] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Photo state
  const [photos, setPhotos] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Bin location state
  const [selectedBins, setSelectedBins] = useState<string[]>([]);
  const [binQtys, setBinQtys] = useState<Record<string, number | null>>({});
  const [binSearch, setBinSearch] = useState("");
  const [binDropdownOpen, setBinDropdownOpen] = useState(false);
  const [binScanOpen, setBinScanOpen] = useState(false);
  const binRef = useRef<HTMLDivElement>(null);

  // SAP mismatch
  const [sapMismatch, setSapMismatch] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  useEffect(() => {
    setItemId(selectedItem?.id ?? "");
    setQty(null);
    setDamagedQty(null);
    setExpiredQty(null);
    setRemark("");
    setPhotos([]);
    setSelectedBins([]);
    setBinQtys({});
    setSapMismatch(false);
    setPendingConfirm(false);
    setMessage("");
  }, [selectedItem?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (binRef.current && !binRef.current.contains(e.target as Node)) {
        setBinDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeItem = useMemo(
    () => selectedItem ?? items.find((item) => item.id === itemId) ?? null,
    [itemId, items, selectedItem]
  );

  const filteredBinOptions = useMemo(
    () => binOptions.filter((b) => !binSearch || b.toLowerCase().includes(binSearch.toLowerCase())),
    [binOptions, binSearch]
  );

  const totalBinQty = useMemo(
    () => Object.values(binQtys).reduce<number>((sum, q) => sum + (q ?? 0), 0),
    [binQtys]
  );

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (photoInputRef.current) photoInputRef.current.value = "";
    try {
      const url = await uploadPhoto(file);
      setPhotos((prev) => [...prev, url]);
    } catch (err) {
      setMessage((err as Error).message || "Failed to upload photo.");
    }
  };

  const toggleBin = (bin: string) => {
    setSelectedBins((prev) => {
      if (prev.includes(bin)) {
        setBinQtys((current) => {
          const copy = { ...current };
          delete copy[bin];
          return copy;
        });
        return prev.filter((b) => b !== bin);
      }
      return [...prev, bin];
    });
  };

  const handleQtyChange = (value: number | null) => {
    setQty(value);
    if (pendingConfirm) {
      setSapMismatch(false);
      setPendingConfirm(false);
      setMessage("");
    }
  };

  const submit = async () => {
    const targetItemId = selectedItem?.id ?? itemId;
    if (!targetItemId) {
      setMessage("Select an item.");
      return;
    }

    if (binOptions.length > 0 && selectedBins.length === 0) {
      setMessage("Select at least one bin location.");
      return;
    }

    let finalQty: number;
    if (selectedBins.length > 1) {
      const allFilled = selectedBins.every((b) => binQtys[b] !== null && binQtys[b] !== undefined);
      if (!allFilled) {
        setMessage("Enter a valid quantity for each bin location.");
        return;
      }
      finalQty = totalBinQty;
    } else {
      if (qty === null) {
        setMessage("Enter a valid quantity.");
        return;
      }
      finalQty = qty;
    }

    // SAP mismatch check — only on first attempt
    if (!pendingConfirm && activeItem && finalQty !== activeItem.sapQty) {
      setSapMismatch(true);
      setPendingConfirm(true);
      setMessage("Quantity doesn't match. Please confirm to proceed.");
      return;
    }

    const binLocation = selectedBins.length > 0 ? selectedBins.join(";") : undefined;

    setLoading(true);
    setSapMismatch(false);
    setPendingConfirm(false);

    await onSubmit({
      itemId: targetItemId,
      qty: finalQty,
      submittedBy: initialSubmittedBy,
      damagedQty: damagedQty,
      expiredQty: expiredQty,
      remark: remark.trim() || undefined,
      photos: photos.length > 0 ? photos : undefined,
      binLocation
    });

    setLoading(false);
    onBack?.();
  };

  return (
    <section className="panel">
      {onBack && selectedItem ? (
        <button type="button" className="cv-back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Back to search</span>
        </button>
      ) : null}

      {activeItem ? (
        <div className="cv-detail-header">
          <div className="cv-detail-code">{activeItem.code}</div>
          <div className="cv-detail-name">{activeItem.name}</div>
          {activeItem.batch ? <div className="cv-detail-batch">Batch: {activeItem.batch}</div> : null}
          {(activeItem.uom || activeItem.packagingSize || activeItem.warehouse || activeItem.whCode) ? (
            <div className="cv-detail-meta-row">
              {activeItem.whCode ? <span className="cv-detail-tag cv-detail-tag-wh">{activeItem.whCode}</span> : null}
              {activeItem.warehouse ? <span className="cv-detail-tag">{activeItem.warehouse}</span> : null}
              {activeItem.uom ? <span className="cv-detail-tag">UoM: {activeItem.uom}</span> : null}
              {activeItem.packagingSize ? <span className="cv-detail-tag">Packaging size: {activeItem.packagingSize}</span> : null}
            </div>
          ) : null}
          {isRecount ? (
            <div className="cv-detail-chips">
              <div className="cv-chip">
                <div className="cv-chip-lbl">SAP Qty</div>
                <div className="cv-chip-val">{activeItem.sapQty}</div>
              </div>
              <div className="cv-chip">
                <div className="cv-chip-lbl">1st Count Qty</div>
                <div className="cv-chip-val">
                  {firstCountQty !== null && firstCountQty !== undefined ? firstCountQty : "-"}
                </div>
              </div>
              <div className="cv-chip">
                <div className="cv-chip-lbl">Bin Location</div>
                <div className="cv-chip-val">{activeItem.warehouse || "-"}</div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="cv-form-section">
        <div className="count-form-grid">
          {!selectedItem ? (
            <div className="count-form-full">
              <label>
                Item
                <select value={itemId} onChange={(event) => setItemId(event.target.value)} className="cv-field-input">
                  <option value="">Select item...</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {/* Bin location searchable combobox */}
          <div className="count-form-full" ref={binRef}>
            <label>Bin Location</label>
            <div className="cv-bin-combobox">
              {/* Selected chips */}
              {selectedBins.length > 0 ? (
                <div className="cv-bin-chips">
                  {selectedBins.map((b) => (
                    <span key={b} className="cv-bin-chip">
                      {b}
                      <button type="button" className="cv-bin-chip-remove" onClick={() => toggleBin(b)}>×</button>
                    </span>
                  ))}
                </div>
              ) : null}
              {/* Search input + chevron + barcode scan */}
              <div className="cv-bin-input-row">
                <input
                  className="cv-bin-search-input"
                  type="text"
                  placeholder="Search bin location..."
                  value={binSearch}
                  onChange={(e) => { setBinSearch(e.target.value); setBinDropdownOpen(true); }}
                  onFocus={() => setBinDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setBinDropdownOpen(false), 150)}
                />
                <button
                  type="button"
                  className="cv-bin-scan-btn"
                  title="Scan bin barcode"
                  onMouseDown={(e) => { e.preventDefault(); setBinScanOpen(true); }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="4" height="4" rx="0.5" /><rect x="17" y="3" width="4" height="4" rx="0.5" /><rect x="3" y="17" width="4" height="4" rx="0.5" />
                    <line x1="7" y1="5" x2="17" y2="5" /><line x1="7" y1="19" x2="12" y2="19" /><line x1="19" y1="7" x2="19" y2="17" /><line x1="5" y1="7" x2="5" y2="17" /><line x1="12" y1="12" x2="12" y2="19" /><line x1="12" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="cv-bin-chevron"
                  style={{ display: "none" }}
                  onMouseDown={(e) => { e.preventDefault(); setBinDropdownOpen((v) => !v); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: binDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
              {/* Dropdown list */}
              {binDropdownOpen ? (
                <div className="cv-bin-dropdown">
                  {filteredBinOptions.length === 0 ? (
                    <div className="cv-bin-empty">No bins found</div>
                  ) : (
                    filteredBinOptions.map((b) => (
                      <div
                        key={b}
                        className={`cv-bin-option ${selectedBins.includes(b) ? "selected" : ""}`}
                        onMouseDown={(e) => { e.preventDefault(); toggleBin(b); setBinSearch(""); setBinDropdownOpen(false); }}
                      >
                        <span>{b}</span>
                        {selectedBins.includes(b) ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            {/* Per-bin qty inputs when multiple bins selected */}
            {selectedBins.length > 1 ? (
              <div className="cv-bin-qty-grid">
                {selectedBins.map((b) => (
                  <div key={b} className="cv-bin-qty-row">
                    <span className="cv-bin-qty-label">{b}</span>
                    <QuantityField
                      value={binQtys[b] ?? null}
                      onChange={(v) => setBinQtys((prev) => ({ ...prev, [b]: v }))}
                      hideButtons
                    />
                  </div>
                ))}
                <div className="cv-bin-qty-total">Total: {totalBinQty}</div>
              </div>
            ) : null}
          </div>

          {/* Count Qty — hidden when multiple bins (uses per-bin inputs instead) */}
          {selectedBins.length <= 1 ? (
            <div>
              <span className="cv-field-label">Count Qty</span>
              <QuantityField value={qty} onChange={handleQtyChange} hideButtons />
            </div>
          ) : null}

          <div>
            <span className="cv-field-label">Damaged Qty</span>
            <QuantityField value={damagedQty} onChange={setDamagedQty} hideButtons />
          </div>

          <div>
            <span className="cv-field-label">Expired Qty</span>
            <QuantityField value={expiredQty} onChange={setExpiredQty} hideButtons />
          </div>

          <div className="count-form-full">
            <label>
              Remark
              <textarea className="cv-textarea" value={remark} onChange={(event) => setRemark(event.target.value)} rows={2} />
            </label>
          </div>

          {/* Photo capture — camera only, works on iOS & Android */}
          <div className="count-form-full">
            <div className="cv-photo-label">Photos</div>
            <input
              ref={photoInputRef}
              id="cv-photo-capture"
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={handlePhotoCapture}
            />
            <label htmlFor="cv-photo-capture" className="cv-photo-btn" style={{ cursor: "pointer" }} title={photos.length === 0 ? "Take photo" : `${photos.length} photo(s)`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              {photos.length > 0 ? <span className="cv-photo-count">{photos.length}</span> : null}
            </label>
            {photos.length > 0 ? (
              <div className="cv-photo-thumbs">
                {photos.map((src, i) => (
                  <div key={i} className="cv-photo-thumb-wrap">
                    <img src={src} alt={`Photo ${i + 1}`} className="cv-photo-thumb" />
                    <button
                      type="button"
                      className="cv-photo-thumb-remove"
                      onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    >×</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {sapMismatch ? (
          <p className="cv-sap-mismatch-msg">{message}</p>
        ) : message ? (
          <p className="cv-submit-msg">{message}</p>
        ) : null}

        <button className="cv-save-btn" onClick={submit} disabled={loading}>
          {loading ? "Submitting..." : pendingConfirm ? "Confirm Save" : "Submit Count"}
        </button>
      </div>

      {binScanOpen ? (
        <CameraScanner
          onDetected={(code) => {
            setBinScanOpen(false);
            const scanned = code.trim();
            if (!scanned) return;
            if (!selectedBins.includes(scanned)) {
              toggleBin(scanned);
            }
            setBinSearch("");
          }}
          onClose={() => setBinScanOpen(false)}
        />
      ) : null}
    </section>
  );
}
