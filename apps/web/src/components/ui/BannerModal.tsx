import { useEffect, useRef, useState } from "react";

interface BannerModalProps {
  message: React.ReactNode;
  type?: "success" | "warning" | "info";
  onClose: () => void;
  autoCloseSeconds?: number;
}

export function BannerModal({ message, type = "info", onClose, autoCloseSeconds = 5 }: BannerModalProps) {
  const [countdown, setCountdown] = useState(autoCloseSeconds);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (countdown <= 0) {
      onCloseRef.current();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  return (
    <div
      className="modal-backdrop banner-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      onClick={onClose}
    >
      <section
        className={`banner-modal banner-modal-${type}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="banner-modal-body">
          <div className="banner-modal-message">{message}</div>
          <button type="button" className="banner-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="banner-modal-footer">
          Closing in {countdown}s · click outside to dismiss
        </div>
      </section>
    </div>
  );
}
