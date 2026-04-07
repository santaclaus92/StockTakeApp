import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/browser";

interface CameraScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

type ScanStatus = "starting" | "scanning" | "error";

export function CameraScanner({ onDetected, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const detectedRef = useRef(false);
  const [status, setStatus] = useState<ScanStatus>("starting");
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  const handleDetected = useCallback(
    (code: string) => {
      if (detectedRef.current) return;
      detectedRef.current = true;
      stopCamera();
      onDetected(code);
    },
    [onDetected, stopCamera]
  );

  useEffect(() => {
    if (!videoRef.current) return;
    let cancelled = false;

    const start = async () => {
      try {
        const reader = new BrowserMultiFormatReader();

        // Prefer rear camera on mobile
        let deviceId: string | undefined;
        try {
          const devices = await BrowserMultiFormatReader.listVideoInputDevices();
          const rear = devices.find((d) => /back|rear|environment/i.test(d.label));
          deviceId = rear?.deviceId ?? devices[devices.length - 1]?.deviceId;
        } catch {
          // fall through — undefined deviceId uses browser default
        }

        if (cancelled) return;

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result, err) => {
            if (result) {
              handleDetected(result.getText());
              return;
            }
            if (err && !(err instanceof NotFoundException)) {
              // real error, not just "no barcode in frame"
              console.warn("Scanner error:", err);
            }
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setStatus("scanning");
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || "Camera access denied.");
          setStatus("error");
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [handleDetected, stopCamera]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const submitManual = () => {
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    handleDetected(trimmed);
  };

  if (status === "error") {
    return (
      <div className="cam-scanner-overlay" role="dialog" aria-modal="true" aria-label="Scanner">
        <button type="button" className="cam-scanner-close" onClick={handleClose} aria-label="Close">✕</button>
        <div className="cam-scanner-fallback">
          <p className="cam-scanner-fallback-msg">{error ?? "Camera unavailable."}</p>
          <p className="cam-scanner-fallback-sub">Enter the barcode manually:</p>
          <input
            className="cam-scanner-fallback-input"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitManual(); }}
            placeholder="Item code or batch..."
            autoFocus
          />
          <div className="cam-scanner-fallback-actions">
            <button type="button" onClick={handleClose}>Cancel</button>
            <button type="button" className="primary-btn" onClick={submitManual} disabled={!manualCode.trim()}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cam-scanner-overlay" role="dialog" aria-modal="true" aria-label="Camera Scanner">
      <button type="button" className="cam-scanner-close" onClick={handleClose} aria-label="Close camera">✕</button>
      <video ref={videoRef} className="cam-scanner-video" playsInline muted autoPlay />
      <div className="cam-scanner-reticle-wrap">
        <div className="cam-scanner-reticle" />
      </div>
      <div className="cam-scanner-hint">
        {status === "starting" ? "Starting camera…" : "Point at a barcode to scan"}
      </div>
    </div>
  );
}
