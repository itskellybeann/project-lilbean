import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let stopped = false;
    let controls: { stop: () => void } | undefined;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result && !stopped) {
          stopped = true;
          controls?.stop();
          onDetected(result.getText());
        }
      })
      .then((c) => {
        controls = c;
      })
      .catch((err) => setError(err?.message || "Could not access camera"));

    return () => {
      stopped = true;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4">
        <span className="text-white font-semibold">Scan barcode</span>
        <button onClick={onClose} className="text-white/70 text-2xl leading-none px-2">
          &times;
        </button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-24 border-2 border-bean-500 rounded-xl" />
      </div>
      {error && <div className="p-4 text-bean-300 text-sm text-center">{error}</div>}
      <p className="p-4 text-center text-white/50 text-sm">Point your camera at a product barcode</p>
    </div>
  );
}
