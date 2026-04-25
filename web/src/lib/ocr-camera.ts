"use client";

export type CameraPermissionState =
  | "idle"
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";

export async function requestRearCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("unsupported");
  }

  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });
}

export function stopCameraStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export function canToggleTorch(stream: MediaStream | null) {
  const track = stream?.getVideoTracks?.()[0] as
    | (MediaStreamTrack & { getCapabilities?: () => MediaTrackCapabilities })
    | undefined;
  const capabilities = track?.getCapabilities?.() as
    | (MediaTrackCapabilities & { torch?: boolean })
    | undefined;
  return Boolean(capabilities?.torch);
}

export async function setTorchEnabled(stream: MediaStream | null, enabled: boolean) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return false;

  try {
    await track.applyConstraints({
      advanced: [{ torch: enabled } as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    return false;
  }
}

export async function captureVideoFrame(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("capture-unavailable");
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("capture-unavailable");
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );

  if (!blob) {
    throw new Error("capture-unavailable");
  }

  return new File([blob], `ocr-scan-${Date.now()}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

