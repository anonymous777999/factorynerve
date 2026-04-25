"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  CameraPermissionState,
  canToggleTorch,
  captureVideoFrame,
  requestRearCamera,
  setTorchEnabled,
  stopCameraStream,
} from "@/lib/ocr-camera";
import { cn } from "@/lib/utils";

type CameraCaptureProps = {
  onClose: () => void;
  onCapture: (file: File) => void;
  onUploadInstead: () => void;
};

export function CameraCapture({
  onClose,
  onCapture,
  onUploadInstead,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [permission, setPermission] = useState<CameraPermissionState>("prompt");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchState] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [flashVisible, setFlashVisible] = useState(false);

  const supportsTorch = useMemo(() => torchSupported, [torchSupported]);

  useEffect(() => {
    let active = true;
    requestRearCamera()
      .then((nextStream) => {
        if (!active) {
          stopCameraStream(nextStream);
          return;
        }
        streamRef.current = nextStream;
        setTorchSupported(canToggleTorch(nextStream));
        setPermission("granted");
        if (videoRef.current) {
          videoRef.current.srcObject = nextStream;
        }
      })
      .catch((error) => {
        if (!active) return;
        setPermission(error instanceof Error && error.message === "unsupported" ? "unsupported" : "denied");
      });

    return () => {
      active = false;
      stopCameraStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const closeCapture = () => {
    stopCameraStream(streamRef.current);
    streamRef.current = null;
    setPermission("idle");
    setTorchSupported(false);
    setTorchState(false);
    setPreviewFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
    onClose();
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    const file = await captureVideoFrame(videoRef.current);
    setFlashVisible(true);
    const nextUrl = URL.createObjectURL(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(file);
    setPreviewUrl(nextUrl);
    window.setTimeout(() => setFlashVisible(false), 160);
  };

  const handleUsePhoto = () => {
    if (!previewFile) return;
    onCapture(previewFile);
    closeCapture();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0f14]">
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-4 text-white">
          <button type="button" className="rounded-full px-3 py-2 text-sm" onClick={closeCapture}>
            Close
          </button>
          {supportsTorch && !previewFile ? (
            <button
              type="button"
              className={cn(
                "rounded-full border px-3 py-2 text-sm transition duration-200",
                torchEnabled ? "border-white/30 bg-white/15" : "border-white/15 bg-transparent",
              )}
              onClick={async () => {
                const next = !torchEnabled;
                const applied = await setTorchEnabled(streamRef.current, next);
                if (applied) {
                  setTorchState(next);
                }
              }}
            >
              Flash
            </button>
          ) : (
            <div className="w-[68px]" />
          )}
        </div>

        <div className="relative flex-1 overflow-hidden">
          {permission === "granted" ? (
            <>
              {previewFile ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Captured preview" className="h-full w-full object-cover" />
              ) : (
                <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
              )}
              {!previewFile ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="grid h-[min(74vw,22rem)] w-[min(74vw,22rem)] grid-cols-3 grid-rows-3 border border-white/18">
                    {Array.from({ length: 9 }, (_, index) => (
                      <div key={index} className="border border-white/10" />
                    ))}
                  </div>
                </div>
              ) : null}
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-white opacity-0 transition duration-150",
                  flashVisible ? "opacity-90" : "opacity-0",
                )}
              />
            </>
          ) : (
            <div className="grid h-full place-items-center px-6 text-center text-white">
              <div className="max-w-xs space-y-4">
                <div className="text-2xl font-semibold">
                  {permission === "prompt"
                    ? "Opening camera"
                    : permission === "unsupported"
                      ? "Camera unavailable"
                      : "Camera access blocked"}
                </div>
                <p className="text-sm leading-6 text-white/70">
                  {permission === "prompt"
                    ? "Waiting for the rear camera."
                    : "Switch to upload and continue the same OCR flow."}
                </p>
                <button
                  type="button"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-[#111827]"
                  onClick={() => {
                    closeCapture();
                    onUploadInstead();
                  }}
                >
                  Upload instead
                </button>
              </div>
            </div>
          )}
        </div>

        {permission === "granted" ? (
          <div className="px-6 pb-8 pt-5">
            {previewFile ? (
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  className="h-12 rounded-full border border-white/15 px-5 text-sm font-medium text-white"
                  onClick={() => {
                    setPreviewFile(null);
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl);
                      setPreviewUrl("");
                    }
                    setPermission("granted");
                  }}
                >
                  Retake
                </button>
                <button
                  type="button"
                  className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-[#111827]"
                  onClick={handleUsePhoto}
                >
                  Use Photo
                </button>
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  type="button"
                  className="ocr-camera-fab ocr-camera-capture relative h-20 w-20 rounded-full bg-white text-[#111827]"
                  onClick={() => void handleCapture()}
                  aria-label="Capture document"
                >
                  <span className="absolute inset-[9px] rounded-full border border-[#111827]/12" />
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
