"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OperationalPageShell } from "@/components/ui/operational-page-shell";
import { DisclosurePanel } from "@/shared/operational/disclosure-panel";
import { Field, Label } from "@/components/ui/field";
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

const profileSurfaceClass =
  "rounded-[1.5rem] border-[0.5px] border-[color:var(--color-border-secondary)] bg-[var(--color-background-secondary)] shadow-[0_18px_48px_rgba(15,23,42,0.08)]";

const profileStatClass =
  "rounded-[1rem] border-[0.5px] border-[color:var(--color-border-tertiary)] bg-[var(--color-background-primary)] px-4 py-4";

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
        window.location.href = "/access";
      }
    }
  };

  const handleSwitchAccount = async () => {
    setAccountBusy("switch");
    try {
      await logout();
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/access?switch_account=1";
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
      window.location.href = "/access?logged_out=all";
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
            <div className="text-sm text-red-400">{sessionError || "Please sign in to continue."}</div>
            {/* AUDIT: FLOW_BROKEN - send signed-out users to the live auth entry instead of the stale login route */}
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <OperationalPageShell
      className="factory-workstation-scope"
      contentClassName="mx-auto max-w-6xl space-y-6"
      eyebrow="Profile"
      title="Your account"
      description="Manage your profile and access."
      metrics={[
        { id: "name", label: "Name", value: profile.name || "-" },
        { id: "role", label: "Role", value: profile.role || "-" },
      ]}
    >

        {sessionError ? (
          <div className="rounded-[20px] border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">
            {sessionError}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-6">
            <Card className={profileSurfaceClass}>
              <CardHeader className="pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm text-[var(--color-text-secondary)]">Identity</div>
                    <CardTitle className="mt-2 text-2xl text-[var(--color-text-primary)]">Profile</CardTitle>
                  </div>
                  <Button
                    variant={editingProfile ? "ghost" : "primary"}
                    className="h-10 px-4"
                    onClick={() => {
                      setEditingProfile((current) => !current);
                      setProfileMessage("");
                      setProfileError("");
                    }}
                  >
                    {editingProfile ? "Cancel" : "Edit"}
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
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[2rem] border-[0.5px] border-[color:var(--color-border-info)] bg-[rgba(var(--color-border-info),0.12)] text-2xl font-semibold text-[var(--color-text-primary)] shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
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
                    <div className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Profile Photo</div>
                    <div className="mt-4 flex w-full flex-col gap-2 sm:w-auto">
                      {/* AUDIT: BUTTON_CLUTTER - keep photo tools available, but shorten the labels so they read like a compact toolset */}
                      <Button
                        variant="ghost"
                        className="h-10 px-4"
                        onClick={() => {
                          setPhotoMessage("");
                          setPhotoError("");
                          uploadInputRef.current?.click();
                        }}
                        disabled={photoBusy !== null}
                      >
                        Upload
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
                        variant="destructive"
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
                          {selectedPhotoPreview ? "Cancel" : photoBusy === "remove" ? "Removing..." : "Remove photo"}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-4">
                    {selectedPhotoPreview ? (
                      <div className="rounded-[1.25rem] border-[0.5px] border-[color:var(--color-border-info)] bg-[rgba(var(--color-border-info),0.08)] p-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Crop selection</div>
                        <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                          <div>
                            <div className="relative aspect-square overflow-hidden rounded-[1.25rem] border-[0.5px] border-[color:var(--color-border-secondary)] bg-[var(--color-background-primary)]">
                              {cropPreviewStyle ? (
                                <>
                                  <img
                                    src={selectedPhotoPreview}
                                    alt="Selected profile crop"
                                    className="pointer-events-none absolute max-w-none select-none"
                                    style={cropPreviewStyle}
                                  />
                                  <div className="pointer-events-none absolute inset-0 border border-[rgba(62,166,255,0.45)] shadow-[inset_0_0_0_999px_rgba(4,8,16,0.28)]" />
                                  <div className="pointer-events-none absolute inset-[14%] rounded-[1rem] border border-dashed border-[color:var(--color-border-secondary)]" />
                                </>
                              ) : null}
                            </div>
                            <div className="mt-4 grid gap-4">
                              <label className="space-y-2">
                                <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
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
                                <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
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
                                <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
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
                          <div className="min-w-0 rounded-[1.25rem] border-[0.5px] border-[color:var(--color-border-secondary)] bg-[var(--color-background-primary)] p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Final preview</div>
                            <div className="mt-4 flex items-center gap-4">
                              <div className="h-24 w-24 overflow-hidden rounded-[1rem] border-[0.5px] border-[color:var(--color-border-tertiary)] bg-[var(--color-background-secondary)]">
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
                                <div className="text-sm font-semibold text-[var(--color-text-primary)]">{selectedPhotoFile?.name || "Selected image"}</div>
                                <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
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
                                variant="ghost"
                                onClick={() => setPhotoCrop(DEFAULT_PHOTO_CROP)}
                                disabled={photoBusy !== null}
                              >
                                Reset crop
                              </Button>
                              <Button
                                variant="ghost"
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
                        <Field>
                          <Label>Name</Label>
                          <Input
                            value={profileForm.name}
                            onChange={(event) =>
                              setProfileForm((current) => ({ ...current, name: event.target.value }))
                            }
                          />
                        </Field>
                        <Field>
                          <Label>Phone</Label>
                          <Input
                            type="tel"
                            autoComplete="tel"
                            inputMode="tel"
                            value={profileForm.phone_number}
                            placeholder="+91..."
                            onChange={(event) =>
                              setProfileForm((current) => ({ ...current, phone_number: event.target.value }))
                            }
                          />
                        </Field>
                        <Field>
                          <Label>Email</Label>
                          <div className="rounded-[8px] border-[0.5px] border-[color:var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                            {profile.email}
                          </div>
                        </Field>
                        <Field>
                          <Label>Role</Label>
                          <div className="rounded-[8px] border-[0.5px] border-[color:var(--color-border-secondary)] bg-[var(--color-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                            {formatRole(profile.role)}
                          </div>
                        </Field>
                        <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-1">
                          <Button onClick={handleProfileSave} disabled={profileBusy}>
                            {profileBusy ? "Saving..." : "Save"}
                          </Button>
                          {profileMessage ? <div className="text-sm text-emerald-300">{profileMessage}</div> : null}
                          {profileError ? <div className="text-sm text-red-300">{profileError}</div> : null}
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className={profileStatClass}>
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Name</div>
                          <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{profile.name}</div>
                        </div>
                        <div className={profileStatClass}>
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Role</div>
                          <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{formatRole(profile.role)}</div>
                        </div>
                        <div className={profileStatClass}>
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Phone</div>
                          <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{profile.phone_number || "Not added"}</div>
                        </div>
                        <div className={profileStatClass}>
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Email</div>
                          <div className="mt-2 break-all text-sm font-semibold text-[var(--color-text-primary)]">{profile.email}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={profileSurfaceClass}>
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-[var(--color-text-secondary)]">Security</div>
                    <CardTitle className="mt-2 text-2xl text-[var(--color-text-primary)]">Password and sessions</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 lg:hidden"
                    onClick={() => toggleSection("security")}
                    aria-label="Toggle security section"
                  >
                    {expandedSections.security ? "-" : "+"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className={sectionContentClass("security")}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={profileStatClass}>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Last Login</div>
                    <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{formatShortDate(profile.last_login)}</div>
                  </div>
                  <div className={profileStatClass}>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Active Devices</div>
                    <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                      {sessionSummary ? sessionSummary.active_devices : "-"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={showPasswordForm ? "ghost" : "primary"}
                    onClick={() => {
                      setShowPasswordForm((current) => !current);
                      setSecurityMessage("");
                      setSecurityError("");
                    }}
                  >
                    {showPasswordForm ? "Cancel" : "Change password"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void handleLogoutAllDevices();
                    }}
                    disabled={accountBusy !== null}
                  >
                    {accountBusy === "logout_all" ? "Logging out..." : "Logout all"}
                  </Button>
                </div>

                {showPasswordForm ? (
                  <div className="space-y-4 rounded-[1.25rem] border-[0.5px] border-[color:var(--color-border-secondary)] bg-[var(--color-background-primary)] p-5">
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
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      Use at least 12 characters with mixed case, a number, and a symbol.
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button onClick={handlePasswordSave} disabled={passwordBusy}>
                        {passwordBusy ? "Updating..." : "Update Password"}
                      </Button>
                      <Link href="/forgot-password">
                        <Button variant="ghost">Forgot Password</Button>
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
            <Card className={profileSurfaceClass}>
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-[var(--color-text-secondary)]">Workspace</div>
                    <CardTitle className="mt-2 text-2xl text-[var(--color-text-primary)]">Current access</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 lg:hidden"
                    onClick={() => toggleSection("workspace")}
                    aria-label="Toggle workspace section"
                  >
                    {expandedSections.workspace ? "-" : "+"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className={sectionContentClass("workspace")}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className={profileStatClass}>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Factory</div>
                    <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                      {activeFactory?.name || profile.factory_name || "Factory not assigned"}
                    </div>
                  </div>
                  <div className={profileStatClass}>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Role</div>
                    <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{formatRole(profile.role)}</div>
                  </div>
                  <div className={profileStatClass}>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Status</div>
                    <div className="mt-2 text-sm font-semibold text-emerald-200">
                      {profile.is_active ? "Active" : "Inactive"}
                    </div>
                  </div>
                  <div className={profileStatClass}>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Organization</div>
                    <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                      {organization?.name || "Current organization"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {showActivity ? (
              <Card className={profileSurfaceClass}>
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm text-[var(--color-text-secondary)]">Activity</div>
                      <CardTitle className="mt-2 text-2xl text-[var(--color-text-primary)]">Recent work</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 lg:hidden"
                      onClick={() => toggleSection("activity")}
                      aria-label="Toggle activity section"
                    >
                      {expandedSections.activity ? "-" : "+"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className={sectionContentClass("activity")}>
                  <div className="grid gap-3">
                    <div className={profileStatClass}>
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Entries Today</div>
                      <div className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{activity.entriesToday}</div>
                    </div>
                    <div className={profileStatClass}>
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Pending Sync</div>
                      <div className="mt-2 text-2xl font-semibold text-[var(--color-text-primary)]">{activity.pendingSync}</div>
                    </div>
                    <div className={profileStatClass}>
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Last Action</div>
                      <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                        {formatDateTime(activity.lastAction)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </section>

        <Card className={profileSurfaceClass}>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-[var(--color-text-secondary)]">Actions</div>
                <CardTitle className="mt-2 text-2xl text-[var(--color-text-primary)]">Account tools</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 lg:hidden"
                onClick={() => toggleSection("actions")}
                aria-label="Toggle actions section"
              >
                {expandedSections.actions ? "-" : "+"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className={sectionContentClass("actions")}>
            {/* AUDIT: BUTTON_CLUTTER - move rare account-level actions into a secondary tray so edit and security stay primary */}
            <DisclosurePanel title="Open account actions" variant="ghost">
              <p className="mb-4 text-sm text-text-secondary">Use these only when you are leaving this account or changing workspace context.</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    void handleLogout();
                  }}
                  disabled={accountBusy !== null}
                >
                  {accountBusy === "logout" ? "Logging out..." : "Logout"}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    void handleSwitchAccount();
                  }}
                  disabled={accountBusy !== null}
                >
                  {accountBusy === "switch" ? "Switching..." : "Switch account"}
                </Button>
              </div>
            </DisclosurePanel>
          </CardContent>
        </Card>
    </OperationalPageShell>
  );
}
