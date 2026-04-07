import { BrowserMultiFormatReader } from "@zxing/browser";
import { useCallback, useEffect, useRef, useState } from "react";

interface CameraScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect(source: HTMLVideoElement | HTMLCanvasElement): Promise<Array<{ rawValue: string }>>;
    };
  }
}

type ScanStatus = "starting" | "scanning" | "error";

export function CameraScanner({ onDetected, onClose }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const detectedRef = useRef(false);
  const [status, setStatus] = useState<ScanStatus>("starting");
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (zxingReaderRef.current) {
      try { (zxingReaderRef.current as unknown as { reset?: () => void }).reset?.(); } catch { /* ignore */ }
      zxingReaderRef.current = null;
    }
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
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus("scanning");
        }

        if (window.BarcodeDetector) {
          // Native BarcodeDetector — crop to viewfinder
          const detector = new window.BarcodeDetector({
            formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "data_matrix"]
          });
          const scan = async () => {
            if (cancelled || detectedRef.current || !videoRef.current || !canvasRef.current) return;
            try {
              const video = videoRef.current;
              const canvas = canvasRef.current;
              const vw = video.videoWidth;
              const vh = video.videoHeight;
              if (vw === 0 || vh === 0) { rafRef.current = requestAnimationFrame(() => { void scan(); }); return; }
              const cropSize = Math.min(vw, vh) * 0.65;
              canvas.width = cropSize;
              canvas.height = cropSize;
              const ctx = canvas.getContext("2d");
              ctx?.drawImage(video, (vw - cropSize) / 2, (vh - cropSize) / 2, cropSize, cropSize, 0, 0, cropSize, cropSize);
              const barcodes = await detector.detect(canvas);
              if (barcodes.length > 0 && barcodes[0].rawValue) { handleDetected(barcodes[0].rawValue); return; }
            } catch { /* expected between frames */ }
            rafRef.current = requestAnimationFrame(() => { void scan(); });
          };
          rafRef.current = requestAnimationFrame(() => { void scan(); });
        } else {
          // Fallback: @zxing/browser — works on iOS Safari, Edge, desktop Chrome
          const reader = new BrowserMultiFormatReader();
          zxingReaderRef.current = reader;
          reader.decodeFromVideoElement(videoRef.current!, (result, err) => {
            if (cancelled || detectedRef.current) return;
            if (result) handleDetected(result.getText());
            void err; // suppress no-result frames
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message || "Camera access denied.");
          setStatus("error");
        }
      }
    };

    void start();
    return () => { cancelled = true; stopCamera(); };
  }, [handleDetected, stopCamera]);

  const handleClose = () => { stopCamera(); onClose(); };

  const submitManual = () => {
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    handleDetected(trimmed);
  };

  return (
    <div className="cam-scanner-overlay" role="dialog" aria-modal="true" aria-label="Camera Scanner">
      <button type="button" className="cam-scanner-close" onClick={handleClose} aria-label="Close camera">✕</button>

      {status === "error" ? (
        <div className="cam-scanner-fallback">
          <p className="cam-scanner-fallback-msg">{error ?? "Camera unavailable."}</p>
          <p className="cam-scanner-fallback-sub">Enter the barcode manually:</p>
          <input
            className="cam-scanner-fallback-input"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitManual(); }}
            placeholder="Item code..."
            autoFocus
          />
          <div className="cam-scanner-fallback-actions">
            <button type="button" onClick={handleClose}>Cancel</button>
            <button type="button" className="primary-btn" onClick={submitManual} disabled={!manualCode.trim()}>Confirm</button>
          </div>
        </div>
      ) : (
        <>
          <video ref={videoRef} className="cam-scanner-video" playsInline muted autoPlay />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div className="cam-scanner-reticle-wrap">
            <div className="cam-scanner-reticle" />
          </div>
          <div className="cam-scanner-hint">
            {status === "starting" ? "Starting camera…" : "Point at a barcode to scan"}
          </div>
        </>
      )}
    </div>
  );
}
