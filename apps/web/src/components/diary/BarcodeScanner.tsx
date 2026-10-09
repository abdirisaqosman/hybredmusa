import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

/**
 * Camera barcode scanning. Typing the number by hand is always available as a
 * fallback, because phone camera permissions fail often enough to matter.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (barcode: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let stop: (() => void) | undefined;
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        if (result && !cancelled) {
          cancelled = true;
          onDetected(result.getText());
        }
      })
      .then((controls) => {
        stop = () => controls.stop();
        if (cancelled) stop();
      })
      .catch(() => setError("Could not start the camera. Type the barcode instead."));

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [onDetected]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <video
      ref={videoRef}
      className="aspect-video w-full rounded-lg bg-muted object-cover"
      muted
      playsInline
    />
  );
}
