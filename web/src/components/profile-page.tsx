"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { API_BASE_URL, ApiError } from "@/lib/api";
import {
  changePassword,
  getSessionSummary,
  logout,
  logoutAllDevices,
  removeProfilePicture,
  uploadProfilePicture,
  updateProfile,
  type CurrentUser,
  type SessionSummary,
} from "@/lib/auth";
import { getTodayEntries } from "@/lib/entries";
import { countQueuedEntries } from "@/lib/offline-entries";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";
import { validatePhoneNumber } from "@/lib/validation";

type SectionKey = "security" | "workspace" | "activity" | "actions";
type AccountBusyAction = "logout" | "switch" | "logout_all" | null;
type PhotoBusyAction = "upload" | "remove" | null;
type PhotoDimensions = {
  width: number;
  height: number;
};
type PhotoCropState = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};
type ActivitySummary = {
  entriesToday: number;
  pendingSync: number;
  lastAction: string | null;
};

const DEFAULT_PHOTO_CROP: PhotoCropState = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatShortDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRole(value?: string | null) {
  if (!value) return "Team Member";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function initialsFromName(value?: string | null) {
  const parts = (value || "")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "A";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function resolveProfilePhotoUrl(value?: string | null) {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${base}${path}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function computeCropWindow(dimensions: PhotoDimensions, crop: PhotoCropState) {
  const baseSize = Math.min(dimensions.width, dimensions.height);
  const cropSize = baseSize / clamp(crop.zoom, 1, 3);
  const maxLeft = Math.max(0, dimensions.width - cropSize);
  const maxTop = Math.max(0, dimensions.height - cropSize);
  const centerLeft = maxLeft / 2;
  const centerTop = maxTop / 2;
  const left = clamp(centerLeft + (crop.offsetX / 100) * centerLeft, 0, maxLeft);
  const top = clamp(centerTop + (crop.offsetY / 100) * centerTop, 0, maxTop);
  return { left, top, cropSize };
}

function buildCropPreviewStyle(dimensions: PhotoDimensions, crop: PhotoCropState) {
  const window = computeCropWindow(dimensions, crop);
  return {
    width: `${(dimensions.width / window.cropSize) * 100}%`,
    height: `${(dimensions.height / window.cropSize) * 100}%`,
    left: `${-(window.left / window.cropSize) * 100}%`,
    top: `${-(window.top / window.cropSize) * 100}%`,
  };
}

async function readImageDimensions(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const probe = new Image();
      probe.onload = () => resolve(probe);
      probe.onerror = () => reject(new Error("Could not read selected image."));
      probe.src = objectUrl;
    });
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function buildCroppedProfileFile(file: File, dimensions: PhotoDimensions, crop: PhotoCropState) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not prepare the cropped image."));
      element.src = sourceUrl;
    });
    const cropWindow = computeCropWindow(dimensions, crop);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not prepare the crop canvas.");
    }
    context.drawImage(
      image,
      cropWindow.left,
      cropWindow.top,
      cropWindow.cropSize,
      cropWindow.cropSize,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (!value) {
          reject(new Error("Could not generate the cropped image."));
          return;
        }
        resolve(value);
      }, "image/jpeg", 0.92);
    });
    const safeName = file.name.replace(/\.[^/.]+$/, "") || "profile-photo";
    return new File([blob], `${safeName}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function roleCanSubmit(role?: string | null) {
  return ["operator", "supervisor", "manager", "admin", "owner"].includes(role || "");
}

export default function ProfilePage() {
  const { user, loading, error: sessionError, activeFactory, organization } = useSession();
  const [profile, setProfile] = useState<CurrentUser | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [activity, setActivity] = useState<ActivitySummary>({
    entriesToday: 0,
    pendingSync: 0,
    lastAction: null,
  });
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    security: false,
    workspace: false,
    activity: false,
    actions: false,
  });
  const [editingProfile, setEditingProfile] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", phone_number: "" });
  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [photoBusy, setPhotoBusy] = useState<PhotoBusyAction>(null);
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);
  const [selectedPhotoDimensions, setSelectedPhotoDimensions] = useState<PhotoDimensions | null>(null);
  const [photoCrop, setPhotoCrop] = useState<PhotoCropState>(DEFAULT_PHOTO_CROP);
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState<AccountBusyAction>(null);
  const [photoMessage, setPhotoMessage] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [securityError, setSecurityError] = useState("");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = roleCanSubmit(profile?.role);
  const showActivity = canSubmit;

  useEffect(() => {
    if (!user) return;
    setProfile(user);
    setProfileForm({
      name: user.name || "",
      phone_number: user.phone_number || "",
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSessionSummary(null);
      setActivity({ entriesToday: 0, pendingSync: 0, lastAction: null });
      return;
    }

    let alive = true;
    const loadMeta = async () => {
      const tasks: Array<Promise<unknown>> = [
        getSessionSummary(),
        canSubmit ? getTodayEntries() : Promise.resolve([]),
        canSubmit ? countQueuedEntries(user.id) : Promise.resolve(0),
      ];

      const [summaryResult, entriesResult, queueResult] = await Promise.allSettled(tasks);
      if (!alive) return;

      if (summaryResult.status === "fulfilled") {
        setSessionSummary(summaryResult.value as SessionSummary);
      }

      setActivity({
        entriesToday:
          entriesResult.status === "fulfilled" && Array.isArray(entriesResult.value)
            ? entriesResult.value.length
            : 0,
        pendingSync:
          queueResult.status === "fulfilled" && typeof queueResult.value === "number"
            ? queueResult.value
            : 0,
        lastAction:
          summaryResult.status === "fulfilled"
            ? ((summaryResult.value as SessionSummary).last_activity || user.last_login || null)
            : user.last_login || null,
      });
    };

    void loadMeta();
    return () => {
      alive = false;
    };
  }, [canSubmit, user]);

  useEffect(() => {
    return () => {
      if (selectedPhotoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(selectedPhotoPreview);
      }
    };
  }, [selectedPhotoPreview]);

  const profileInitials = useMemo(() => initialsFromName(profile?.name), [profile?.name]);
  const savedPhotoUrl = useMemo(
    () => resolveProfilePhotoUrl(profile?.profile_picture),
    [profile?.profile_picture],
  );
  const displayPhotoUrl = selectedPhotoPreview || savedPhotoUrl;
  const cropPreviewStyle = useMemo(
    () =>
      selectedPhotoDimensions
        ? buildCropPreviewStyle(selectedPhotoDimensions, photoCrop)
        : null,
    [photoCrop, selectedPhotoDimensions],
  );

  const toggleSection = (key: SectionKey) => {
    setExpandedSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const sectionContentClass = (key: SectionKey) =>
    cn("mt-4 space-y-4", expandedSections[key] ? "block" : "hidden lg:block");

  const clearSelectedPhoto = () => {
    if (selectedPhotoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(selectedPhotoPreview);
    }
    setSelectedPhotoFile(null);
    setSelectedPhotoPreview(null);
    setSelectedPhotoDimensions(null);
    setPhotoCrop(DEFAULT_PHOTO_CROP);
  };

  const handlePhotoSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPhotoMessage("");
      setPhotoError("Choose an image file for your profile photo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoMessage("");
      setPhotoError("Profile photo must be 5 MB or smaller.");
      return;
    }

    try {
      const dimensions = await readImageDimensions(file);
      const previewUrl = URL.createObjectURL(file);
      clearSelectedPhoto();
      setSelectedPhotoFile(file);
      setSelectedPhotoPreview(previewUrl);
      setSelectedPhotoDimensions(dimensions);
      setPhotoCrop(DEFAULT_PHOTO_CROP);
      setPhotoMessage("");
      setPhotoError("");
    } catch (error) {
      clearSelectedPhoto();
      setPhotoMessage("");
      if (error instanceof Error) {
        setPhotoError(error.message);
      } else {
        setPhotoError("Could not prepare this image for cropping.");
      }
    }
  };

  const handlePhotoUpload = async () => {
    if (!selectedPhotoFile || !selectedPhotoDimensions) {
      return;
    }
    setPhotoBusy("upload");
    setPhotoMessage("");
    setPhotoError("");
    try {
      const croppedFile = await buildCroppedProfileFile(selectedPhotoFile, selectedPhotoDimensions, photoCrop);
      const updated = await uploadProfilePicture(croppedFile);
      setProfile(updated);
      clearSelectedPhoto();
      setPhotoMessage("Profile photo updated successfully.");
    } catch (error) {
      if (error instanceof ApiError) {
        setPhotoError(error.message);
      } else if (error instanceof Error) {
        setPhotoError(error.message);
      } else {
        setPhotoError("Could not upload profile photo.");
      }
    } finally {
      setPhotoBusy(null);
    }
  };

  const handlePhotoRemove = async () => {
    setPhotoBusy("remove");
    setPhotoMessage("");
    setPhotoError("");
    try {
      const updated = await removeProfilePicture();
      setProfile(updated);
      clearSelectedPhoto();
      setPhotoMessage("Profile photo removed.");
    } catch (error) {
      if (error instanceof ApiError) {
        setPhotoError(error.message);
      } else if (error instanceof Error) {
        setPhotoError(error.message);
      } else {
        setPhotoError("Could not remove profile photo.");
      }
    } finally {
      setPhotoBusy(null);
    }
  };

  const handleProfileSave = async () => {
    setProfileBusy(true);
    setProfileMessage("");
    setProfileError("");
    try {
      const phoneError = validatePhoneNumber(profileForm.phone_number, "Phone number");
      if (phoneError) {
        throw new Error(phoneError);
      }
      const updated = await updateProfile({
        name: profileForm.name,
        phone_number: profileForm.phone_number || null,
      });
      setProfile(updated);
      setProfileForm({
        name: updated.name || "",
        phone_number: updated.phone_number || "",
      });
      setEditingProfile(false);
      setProfileMessage("Profile updated successfully.");
    } catch (error) {
      if (error instanceof ApiError) {
        setProfileError(error.message);
      } else if (error instanceof Error) {
        setProfileError(error.message);
      } else {
        setProfileError("Could not update profile.");
      }
    } finally {
      setProfileBusy(false);
    }
  };

  const handlePasswordSave = async () => {
    setPasswordBusy(true);
    setSecurityMessage("");
    setSecurityError("");
    try {
      if (passwordForm.new_password !== passwordForm.confirm_password) {
        throw new Error("New password and confirmation must match.");
      }
      await changePassword({
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ old_password: "", new_password: "", confirm_password: "" });
      setShowPasswordForm(false);
      setSecurityMessage("Password changed successfully.");
    } catch (error) {
      if (error instanceof ApiError) {
        setSecurityError(error.message);
      } else if (error instanceof Error) {
        setSecurityError(error.message);
      } else {
        setSecurityError("Could not change password.");
      }
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleLogout = async () => {
    setAccountBusy("logout");
    try {
      await logout();
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  const handleSwitchAccount = async () => {
    setAccountBusy("switch");
    try {
      await logout();
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/login?switch_account=1";
      }
    }
  };

  const handleLogoutAllDevices = async () => {
    setAccountBusy("logout_all");
    setSecurityMessage("");
    setSecurityError("");
    try {
      await logoutAllDevices();
    } catch (error) {
      if (error instanceof ApiError) {
        setSecurityError(error.message);
      } else if (error instanceof Error) {
        setSecurityError(error.message);
      } else {
        setSecurityError("Could not log out all devices.");
      }
      setAccountBusy(null);
      return;
    }

    if (typeof window !== "undefined") {
      window.location.href = "/login?logged_out=all";
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading profile...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please login to continue."}</div>
            <Link href="/login">
              <Button>Open Login</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B0F19] px-4 py-6 md:px-8 lg:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,36,0.96),rgba(11,15,25,0.98))] p-6 shadow-[0_24px_80px_rgba(6,10,18,0.42)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[rgba(62,166,255,0.88)]">
            Profile
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Your account</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Manage your identity, security, workspace access, and account actions from one simple page.
          </p>
        </section>

        {sessionError ? (
          <div className="rounded-[20px] border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">
            {sessionError}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-6">
            <Card className="rounded-[2rem] border-white/10 bg-[rgba(20,24,36,0.9)]">
              <CardHeader className="pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-slate-400">Identity</div>
                    <CardTitle className="mt-2 text-2xl text-white">Profile</CardTitle>
                  </div>
                  <Button
                    variant={editingProfile ? "outline" : "primary"}
                    className="h-10 px-4"
                    onClick={() => {
                      setEditingProfile((current) => !current);
                      setProfileMessage("");
                      setProfileError("");
                    }}
                  >
                    {editingProfile ? "Cancel" : "Edit Profile"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelection}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handlePhotoSelection}
                />
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                  <div className="flex flex-col items-center sm:items-start">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[2rem] border border-[rgba(62,166,255,0.24)] bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(96,165,250,0.22))] text-2xl font-semibold text-white shadow-[0_16px_40px_rgba(34,211,238,0.14)]">
                      {displayPhotoUrl ? (
                        <img
                          src={displayPhotoUrl}
                          alt={`${profile.name} profile`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        profileInitials
                      )}
                    </div>
                    <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">Profile Photo</div>
                    <div className="mt-4 flex w-full flex-col gap-2 sm:w-auto">
                      <Button
                        variant="outline"
                        className="h-10 px-4"
                        onClick={() => {
                          setPhotoMessage("");
                          setPhotoError("");
                          uploadInputRef.current?.click();
                        }}
                        disabled={photoBusy !== null}
                      >
                        Upload from device
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-10 px-4"
                        onClick={() => {
                          setPhotoMessage("");
                          setPhotoError("");
                          cameraInputRef.current?.click();
                        }}
                        disabled={photoBusy !== null}
                      >
                        Take photo
                      </Button>
                      {profile.profile_picture || selectedPhotoPreview ? (
                        <Button
                          variant="ghost"
                          className="h-10 px-4"
                          onClick={() => {
                            if (selectedPhotoPreview) {
                              clearSelectedPhoto();
                              setPhotoMessage("");
                              setPhotoError("");
                              return;
                            }
                            void handlePhotoRemove();
                          }}
                          disabled={photoBusy !== null}
                        >
                          {selectedPhotoPreview ? "Cancel preview" : photoBusy === "remove" ? "Removing..." : "Remove photo"}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-4">
                    {selectedPhotoPreview ? (
                      <div className="rounded-[1.7rem] border border-[rgba(62,166,255,0.26)] bg-[rgba(8,12,20,0.56)] p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Crop selection</div>
                        <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                          <div>
                            <div className="relative aspect-square overflow-hidden rounded-[1.7rem] border border-white/10 bg-[rgba(15,23,42,0.9)]">
                              {cropPreviewStyle ? (
                                <>
                                  <img
                                    src={selectedPhotoPreview}
                                    alt="Selected profile crop"
                                    className="pointer-events-none absolute max-w-none select-none"
                                    style={cropPreviewStyle}
                                  />
                                  <div className="pointer-events-none absolute inset-0 border border-[rgba(62,166,255,0.45)] shadow-[inset_0_0_0_999px_rgba(4,8,16,0.28)]" />
                                  <div className="pointer-events-none absolute inset-[14%] rounded-[1.35rem] border border-dashed border-white/35" />
                                </>
                              ) : null}
                            </div>
                            <div className="mt-4 grid gap-4">
                              <label className="space-y-2">
                                <div className="flex items-center justify-between text-sm text-slate-300">
                                  <span>Zoom</span>
                                  <span>{photoCrop.zoom.toFixed(1)}x</span>
                                </div>
                                <input
                                  type="range"
                                  min="1"
                                  max="3"
                                  step="0.1"
                                  value={photoCrop.zoom}
                                  onChange={(event) =>
                                    setPhotoCrop((current) => ({
                                      ...current,
                                      zoom: Number(event.target.value),
                                    }))
                                  }
                                  className="w-full accent-[rgb(62,166,255)]"
                                />
                              </label>
                              <label className="space-y-2">
                                <div className="flex items-center justify-between text-sm text-slate-300">
                                  <span>Left / Right</span>
                                  <span>{photoCrop.offsetX > 0 ? `+${photoCrop.offsetX}` : photoCrop.offsetX}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="-100"
                                  max="100"
                                  step="1"
                                  value={photoCrop.offsetX}
                                  onChange={(event) =>
                                    setPhotoCrop((current) => ({
                                      ...current,
                                      offsetX: Number(event.target.value),
                                    }))
                                  }
                                  className="w-full accent-[rgb(62,166,255)]"
                                />
                              </label>
                              <label className="space-y-2">
                                <div className="flex items-center justify-between text-sm text-slate-300">
                                  <span>Up / Down</span>
                                  <span>{photoCrop.offsetY > 0 ? `+${photoCrop.offsetY}` : photoCrop.offsetY}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="-100"
                                  max="100"
                                  step="1"
                                  value={photoCrop.offsetY}
                                  onChange={(event) =>
                                    setPhotoCrop((current) => ({
                                      ...current,
                                      offsetY: Number(event.target.value),
                                    }))
                                  }
                                  className="w-full accent-[rgb(62,166,255)]"
                                />
                              </label>
                            </div>
                          </div>
                          <div className="min-w-0 rounded-[1.7rem] border border-white/10 bg-[rgba(15,23,42,0.64)] p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Final preview</div>
                            <div className="mt-4 flex items-center gap-4">
                              <div className="h-24 w-24 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[rgba(8,12,20,0.9)]">
                                {cropPreviewStyle ? (
                                  <div className="relative h-full w-full overflow-hidden">
                                    <img
                                      src={selectedPhotoPreview}
                                      alt="Final profile preview"
                                      className="pointer-events-none absolute max-w-none select-none"
                                      style={cropPreviewStyle}
                                    />
                                  </div>
                                ) : null}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-white">{selectedPhotoFile?.name || "Selected image"}</div>
                                <div className="mt-2 text-sm text-slate-300">
                                  Adjust the crop until the face sits cleanly inside the frame, then save it.
                                </div>
                              </div>
                            </div>
                            <div className="mt-5 flex flex-wrap gap-3">
                              <Button
                                onClick={() => void handlePhotoUpload()}
                                disabled={photoBusy !== null || !selectedPhotoDimensions}
                              >
                                {photoBusy === "upload" ? "Uploading..." : "Save photo"}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => setPhotoCrop(DEFAULT_PHOTO_CROP)}
                                disabled={photoBusy !== null}
                              >
                                Reset crop
                              </Button>
                              <Button
                                variant="outline"
                                onClick={clearSelectedPhoto}
                                disabled={photoBusy !== null}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {photoMessage ? <div className="text-sm text-emerald-300">{photoMessage}</div> : null}
                    {photoError ? <div className="text-sm text-red-300">{photoError}</div> : null}

                    {editingProfile ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="text-sm text-slate-400">Name</label>
                          <Input
                            className="mt-2"
                            value={profileForm.name}
                            onChange={(event) =>
                              setProfileForm((current) => ({ ...current, name: event.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <label className="text-sm text-slate-400">Phone</label>
                          <Input
                            className="mt-2"
                            type="tel"
                            autoComplete="tel"
                            inputMode="tel"
                            value={profileForm.phone_number}
                            placeholder="+91..."
                            onChange={(event) =>
                              setProfileForm((current) => ({ ...current, phone_number: event.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <div className="text-sm text-slate-400">Email</div>
                          <div className="mt-2 rounded-2xl border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-3 text-sm text-white">
                            {profile.email}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-slate-400">Role</div>
                          <div className="mt-2 rounded-2xl border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-3 text-sm text-white">
                            {formatRole(profile.role)}
                          </div>
                        </div>
                        <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-1">
                          <Button onClick={handleProfileSave} disabled={profileBusy}>
                            {profileBusy ? "Saving..." : "Save Profile"}
                          </Button>
                          {profileMessage ? <div className="text-sm text-emerald-300">{profileMessage}</div> : null}
                          {profileError ? <div className="text-sm text-red-300">{profileError}</div> : null}
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-[1.4rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Name</div>
                          <div className="mt-2 text-sm font-semibold text-white">{profile.name}</div>
                        </div>
                        <div className="rounded-[1.4rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Role</div>
                          <div className="mt-2 text-sm font-semibold text-white">{formatRole(profile.role)}</div>
                        </div>
                        <div className="rounded-[1.4rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Phone</div>
                          <div className="mt-2 text-sm font-semibold text-white">{profile.phone_number || "Not added"}</div>
                        </div>
                        <div className="rounded-[1.4rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Email</div>
                          <div className="mt-2 break-all text-sm font-semibold text-white">{profile.email}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-white/10 bg-[rgba(20,24,36,0.9)]">
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-slate-400">Security</div>
                    <CardTitle className="mt-2 text-2xl text-white">Password and sessions</CardTitle>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[rgba(8,12,20,0.5)] text-lg text-white lg:hidden"
                    onClick={() => toggleSection("security")}
                    aria-label="Toggle security section"
                  >
                    {expandedSections.security ? "-" : "+"}
                  </button>
                </div>
              </CardHeader>
              <CardContent className={sectionContentClass("security")}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.4rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Last Login</div>
                    <div className="mt-2 text-sm font-semibold text-white">{formatShortDate(profile.last_login)}</div>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Active Devices</div>
                    <div className="mt-2 text-sm font-semibold text-white">
                      {sessionSummary ? sessionSummary.active_devices : "-"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={showPasswordForm ? "outline" : "primary"}
                    onClick={() => {
                      setShowPasswordForm((current) => !current);
                      setSecurityMessage("");
                      setSecurityError("");
                    }}
                  >
                    {showPasswordForm ? "Cancel Password Change" : "Change Password"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void handleLogoutAllDevices();
                    }}
                    disabled={accountBusy !== null}
                  >
                    {accountBusy === "logout_all" ? "Logging out..." : "Logout All Devices"}
                  </Button>
                </div>

                {showPasswordForm ? (
                  <div className="space-y-4 rounded-[1.7rem] border border-white/10 bg-[rgba(8,12,20,0.5)] p-5">
                    <PasswordField
                      label="Current Password"
                      value={passwordForm.old_password}
                      autoComplete="current-password"
                      onChange={(value) => setPasswordForm((current) => ({ ...current, old_password: value }))}
                      required
                    />
                    <PasswordField
                      label="New Password"
                      value={passwordForm.new_password}
                      autoComplete="new-password"
                      onChange={(value) => setPasswordForm((current) => ({ ...current, new_password: value }))}
                      required
                    />
                    <PasswordField
                      label="Confirm New Password"
                      value={passwordForm.confirm_password}
                      autoComplete="new-password"
                      onChange={(value) => setPasswordForm((current) => ({ ...current, confirm_password: value }))}
                      required
                    />
                    <div className="text-xs text-slate-400">
                      Use at least 12 characters with mixed case, a number, and a symbol.
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button onClick={handlePasswordSave} disabled={passwordBusy}>
                        {passwordBusy ? "Updating..." : "Update Password"}
                      </Button>
                      <Link href="/forgot-password">
                        <Button variant="outline">Forgot Password</Button>
                      </Link>
                    </div>
                  </div>
                ) : null}

                {securityMessage ? <div className="text-sm text-emerald-300">{securityMessage}</div> : null}
                {securityError ? <div className="text-sm text-red-300">{securityError}</div> : null}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-[2rem] border-white/10 bg-[rgba(20,24,36,0.9)]">
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-slate-400">Workspace</div>
                    <CardTitle className="mt-2 text-2xl text-white">Current access</CardTitle>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[rgba(8,12,20,0.5)] text-lg text-white lg:hidden"
                    onClick={() => toggleSection("workspace")}
                    aria-label="Toggle workspace section"
                  >
                    {expandedSections.workspace ? "-" : "+"}
                  </button>
                </div>
              </CardHeader>
              <CardContent className={sectionContentClass("workspace")}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[1.4rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Factory</div>
                    <div className="mt-2 text-sm font-semibold text-white">
                      {activeFactory?.name || profile.factory_name || "Factory not assigned"}
                    </div>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Role</div>
                    <div className="mt-2 text-sm font-semibold text-white">{formatRole(profile.role)}</div>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Status</div>
                    <div className="mt-2 text-sm font-semibold text-emerald-200">
                      {profile.is_active ? "Active" : "Inactive"}
                    </div>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Organization</div>
                    <div className="mt-2 text-sm font-semibold text-white">
                      {organization?.name || "Current organization"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {showActivity ? (
              <Card className="rounded-[2rem] border-white/10 bg-[rgba(20,24,36,0.9)]">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm text-slate-400">Activity</div>
                      <CardTitle className="mt-2 text-2xl text-white">Recent work</CardTitle>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[rgba(8,12,20,0.5)] text-lg text-white lg:hidden"
                      onClick={() => toggleSection("activity")}
                      aria-label="Toggle activity section"
                    >
                      {expandedSections.activity ? "-" : "+"}
                    </button>
                  </div>
                </CardHeader>
                <CardContent className={sectionContentClass("activity")}>
                  <div className="grid gap-3">
                    <div className="rounded-[1.4rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Entries Today</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{activity.entriesToday}</div>
                    </div>
                    <div className="rounded-[1.4rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Pending Sync</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{activity.pendingSync}</div>
                    </div>
                    <div className="rounded-[1.4rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Last Action</div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        {formatDateTime(activity.lastAction)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </section>

        <Card className="rounded-[2rem] border-white/10 bg-[rgba(20,24,36,0.9)]">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-slate-400">Actions</div>
                <CardTitle className="mt-2 text-2xl text-white">Account actions</CardTitle>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[rgba(8,12,20,0.5)] text-lg text-white lg:hidden"
                onClick={() => toggleSection("actions")}
                aria-label="Toggle actions section"
              >
                {expandedSections.actions ? "-" : "+"}
              </button>
            </div>
          </CardHeader>
          <CardContent className={sectionContentClass("actions")}>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  void handleLogout();
                }}
                disabled={accountBusy !== null}
              >
                {accountBusy === "logout" ? "Logging out..." : "Logout"}
              </Button>
              <Button
                onClick={() => {
                  void handleSwitchAccount();
                }}
                disabled={accountBusy !== null}
              >
                {accountBusy === "switch" ? "Switching..." : "Switch Account"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
