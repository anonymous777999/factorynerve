"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, formatApiErrorMessage } from "@/lib/api";
import { pushAppToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  categoriesFromRecipient,
  categoriesToPreferences,
  createAlertRecipient,
  deleteAlertRecipient,
  emptyAlertCategoryState,
  formatAlertEventTypeLabel,
  getAlertActivityDetail,
  listAlertActivity,
  listAlertRecipients,
  startAlertRecipientVerification,
  summarizeRecipientCategories,
  type AlertActivityDetail,
  type AlertActivityItem,
  type AlertCategoryState,
  type AlertRecipient,
  type AlertRecipientListPayload,
  updateAlertRecipient,
  confirmAlertRecipientVerification,
} from "@/lib/settings-alerts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { SafeText } from "@/components/ui/safe-text";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  active: boolean;
};

type AlertFormState = {
  phone_number: string;
  categories: AlertCategoryState;
  is_active: boolean;
};

type AlertPanelState =
  | {
      open: false;
      mode: "add" | "edit";
      recipientId: number | null;
    }
  | {
      open: true;
      mode: "add" | "edit";
      recipientId: number | null;
    };

type VerificationModalState = {
  open: boolean;
  recipientId: number | null;
  phone: string;
  maskedPhone: string;
  otp: string;
  expiresAt: number | null;
  submitting: boolean;
  error: string;
};

type ApiErrorDetail = {
  code?: string;
  message?: string;
  retry_after?: number;
  attempts_remaining?: number;
};

function emptyAlertFormState(): AlertFormState {
  return {
    phone_number: "",
    categories: {
      ...emptyAlertCategoryState(),
      machineDowntime: false,
    },
    is_active: false,
  };
}

function detailFromError(error: unknown): ApiErrorDetail | null {
  if (!(error instanceof ApiError) || !error.detail || typeof error.detail !== "object") {
    return null;
  }
  return error.detail as ApiErrorDetail;
}

function verificationStatusTone(status: string) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "verified") return "border-emerald-400/30 bg-emerald-500/12 text-emerald-200";
  if (normalized === "failed") return "border-red-400/30 bg-red-500/12 text-red-200";
  return "border-amber-400/30 bg-amber-500/12 text-amber-100";
}

function deliveryTone(status: string) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "delivered" || normalized === "success") return "border-emerald-400/30 bg-emerald-500/12 text-emerald-200";
  if (normalized === "suppressed" || normalized.startsWith("dropped")) return "border-amber-400/30 bg-amber-500/12 text-amber-100";
  if (normalized === "failed" || normalized === "partial_failure") return "border-red-400/30 bg-red-500/12 text-red-200";
  return "border-[var(--border)] bg-white/5 text-[var(--muted)]";
}

function severityTone(severity: string) {
  const normalized = String(severity || "").trim().toUpperCase();
  if (normalized === "CRITICAL") return "border-red-400/30 bg-red-500/12 text-red-200";
  if (normalized === "HIGH") return "border-orange-400/30 bg-orange-500/12 text-orange-100";
  if (normalized === "MEDIUM") return "border-amber-400/30 bg-amber-500/12 text-amber-100";
  return "border-sky-400/30 bg-sky-500/12 text-sky-100";
}

function maskPhoneNumber(value: string | null | undefined) {
  const raw = String(value || "").replace(/^whatsapp:/i, "").trim();
  if (!raw) return "-";
  const startLength = raw.startsWith("+") ? Math.min(3, raw.length) : Math.min(2, raw.length);
  const start = raw.slice(0, startLength);
  const end = raw.slice(-4);
  const hiddenLength = Math.max(6, raw.length - start.length - end.length);
  return `${start}${"*".repeat(hiddenLength)}${end}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCountdown(seconds: number) {
  if (seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function readableDeliveryStatus(value: string) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildFormState(recipient: AlertRecipient): AlertFormState {
  return {
    phone_number: recipient.phone_e164 || recipient.phone_number || "",
    categories: categoriesFromRecipient(recipient),
    is_active: recipient.is_active,
  };
}

function mapVerificationError(error: unknown) {
  const detail = detailFromError(error);
  if (!detail?.code) {
    return formatApiErrorMessage(error, "Verification could not be completed.");
  }
  if (detail.code === "invalid_otp") {
    return detail.attempts_remaining != null
      ? `Invalid OTP. ${detail.attempts_remaining} attempt${detail.attempts_remaining === 1 ? "" : "s"} left.`
      : "Invalid OTP. Please check the code and try again.";
  }
  if (detail.code === "otp_expired") {
    return "This OTP has expired. Request a new code to continue.";
  }
  if (detail.code === "max_attempts_reached") {
    return "Too many invalid attempts. Start verification again to get a new code.";
  }
  if (detail.code === "no_active_otp") {
    return "No active OTP was found. Request a new code first.";
  }
  if (detail.code === "sms_delivery_failed") {
    return "The verification code could not be delivered right now. Please retry.";
  }
  if (detail.code === "rate_limited" || detail.code === "cooldown_active") {
    return detail.retry_after
      ? `Too many verification requests. Retry in ${formatCountdown(detail.retry_after)}.`
      : "Too many verification requests. Please wait before trying again.";
  }
  return detail.message || formatApiErrorMessage(error, "Verification could not be completed.");
}

function ActionModal({
  open,
  title,
  subtitle,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(3,7,18,0.72)] px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-[32px] border border-[var(--border)] bg-[rgba(11,16,25,0.98)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
          <div>
            <div className="text-sm uppercase tracking-[0.18em] text-[var(--accent)]">Alerts</div>
            <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
            {subtitle ? <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p> : null}
          </div>
          <Button variant="ghost" onClick={onClose} className="px-3 py-2 text-xs uppercase tracking-[0.18em]">
            Close
          </Button>
        </div>
        <div className="max-h-[calc(90vh_-_108px)] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default function SettingsAlertsTab({ active }: Props) {
  const [recipientPayload, setRecipientPayload] = useState<AlertRecipientListPayload | null>(null);
  const [activityRows, setActivityRows] = useState<AlertActivityItem[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [recipientsLoaded, setRecipientsLoaded] = useState(false);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [recipientsError, setRecipientsError] = useState("");
  const [activityError, setActivityError] = useState("");
  const [panel, setPanel] = useState<AlertPanelState>({ open: false, mode: "add", recipientId: null });
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelSubmitting, setPanelSubmitting] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [form, setForm] = useState<AlertFormState>(() => emptyAlertFormState());
  const [togglePendingId, setTogglePendingId] = useState<number | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<number | null>(null);
  const [verifyPendingId, setVerifyPendingId] = useState<number | null>(null);
  const [verifyCooldownUntil, setVerifyCooldownUntil] = useState<Record<number, number>>({});
  const [nowTs, setNowTs] = useState(Date.now());
  const [verificationModal, setVerificationModal] = useState<VerificationModalState>({
    open: false,
    recipientId: null,
    phone: "",
    maskedPhone: "",
    otp: "",
    expiresAt: null,
    submitting: false,
    error: "",
  });
  const [selectedAlertRef, setSelectedAlertRef] = useState<string>("");
  const [selectedAlert, setSelectedAlert] = useState<AlertActivityDetail | null>(null);
  const [selectedAlertLoading, setSelectedAlertLoading] = useState(false);
  const [selectedAlertError, setSelectedAlertError] = useState("");

  const recipients = useMemo(() => recipientPayload?.recipients || [], [recipientPayload]);
  const selectedRecipient = useMemo(
    () => recipients.find((recipient) => recipient.id === panel.recipientId) || null,
    [panel.recipientId, recipients],
  );
  const latestAlert = activityRows[0] || null;

  const loadRecipients = useCallback(async () => {
    setRecipientsLoading(true);
    setRecipientsError("");
    try {
      const payload = await listAlertRecipients();
      setRecipientPayload(payload);
      setRecipientsLoaded(true);
    } catch (error) {
      setRecipientsError(formatApiErrorMessage(error, "Could not load alert recipients."));
      setRecipientsLoaded(true);
    } finally {
      setRecipientsLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError("");
    try {
      const payload = await listAlertActivity(10);
      setActivityRows(payload.alerts || []);
      setActivityLoaded(true);
    } catch (error) {
      setActivityError(formatApiErrorMessage(error, "Could not load alert activity."));
      setActivityLoaded(true);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const loadAlertDetail = useCallback(async (refId: string) => {
    setSelectedAlertRef(refId);
    setSelectedAlertLoading(true);
    setSelectedAlertError("");
    try {
      const detail = await getAlertActivityDetail(refId);
      setSelectedAlert(detail);
    } catch (error) {
      setSelectedAlert(null);
      setSelectedAlertError(formatApiErrorMessage(error, "Could not load alert delivery detail."));
    } finally {
      setSelectedAlertLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    if (!recipientsLoaded && !recipientsLoading) {
      void loadRecipients();
    }
    if (!activityLoaded && !activityLoading) {
      void loadActivity();
    }
  }, [active, activityLoaded, activityLoading, loadActivity, loadRecipients, recipientsLoaded, recipientsLoading]);

  useEffect(() => {
    if (!active) return;
    const intervalId = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [active]);

  const getCooldownSeconds = useCallback(
    (recipientId: number) => {
      const until = verifyCooldownUntil[recipientId];
      if (!until) return 0;
      return Math.max(0, Math.ceil((until - nowTs) / 1000));
    },
    [nowTs, verifyCooldownUntil],
  );

  const applyCooldown = useCallback((recipientId: number, retryAfterSeconds: number) => {
    setVerifyCooldownUntil((current) => ({
      ...current,
      [recipientId]: Date.now() + retryAfterSeconds * 1000,
    }));
  }, []);

  const closePanel = () => {
    setPanel({ open: false, mode: "add", recipientId: null });
    setPanelError("");
    setPanelLoading(false);
    setPanelSubmitting(false);
    setForm(emptyAlertFormState());
  };

  const openAddModal = () => {
    setPanel({ open: true, mode: "add", recipientId: null });
    setPanelError("");
    setPanelLoading(false);
    setForm({
      ...emptyAlertFormState(),
      categories: {
        critical: true,
        warning: true,
        security: true,
        reports: true,
        machineDowntime: false,
      },
    });
  };

  const openEditModal = async (recipientId: number) => {
    setPanel({ open: true, mode: "edit", recipientId });
    setPanelLoading(true);
    setPanelError("");
    try {
      const payload = await listAlertRecipients();
      setRecipientPayload(payload);
      const freshRecipient = payload.recipients.find((recipient) => recipient.id === recipientId);
      if (!freshRecipient) {
        throw new Error("Recipient no longer exists.");
      }
      setForm(buildFormState(freshRecipient));
    } catch (error) {
      setPanelError(formatApiErrorMessage(error, "Could not load recipient configuration."));
    } finally {
      setPanelLoading(false);
    }
  };

  const savePanel = async () => {
    const trimmedPhone = form.phone_number.trim();
    if (!trimmedPhone) {
      setPanelError("Phone number is required.");
      return;
    }
    setPanelSubmitting(true);
    setPanelError("");
    try {
      const preferences = categoriesToPreferences(form.categories);
      if (panel.mode === "add") {
        await createAlertRecipient({
          phone_number: trimmedPhone,
          event_types: preferences.event_types,
          severity_levels: preferences.severity_levels,
          receive_daily_summary: preferences.receive_daily_summary,
          is_active: false,
        });
        pushAppToast({
          title: "Recipient added",
          description: "The number was saved as pending. Verify it before enabling alerts.",
          tone: "success",
        });
      } else {
        if (!selectedRecipient) {
          throw new Error("Recipient no longer exists.");
        }
        const phoneChanged = trimmedPhone !== (selectedRecipient.phone_e164 || selectedRecipient.phone_number || "").trim();
        await updateAlertRecipient(selectedRecipient.id, {
          phone_number: trimmedPhone,
          event_types: preferences.event_types,
          severity_levels: preferences.severity_levels,
          receive_daily_summary: preferences.receive_daily_summary,
          is_active: phoneChanged ? false : form.is_active,
        });
        pushAppToast({
          title: "Recipient updated",
          description: phoneChanged
            ? "Phone number changed. Verification was reset and alerts stayed disabled until re-verified."
            : "Alert delivery settings were updated.",
          tone: "success",
        });
      }
      await loadRecipients();
      closePanel();
    } catch (error) {
      const message = formatApiErrorMessage(error, "Could not save alert recipient.");
      setPanelError(message);
      pushAppToast({
        title: "Save failed",
        description: `${message} Retry once the issue is resolved.`,
        tone: "error",
      });
    } finally {
      setPanelSubmitting(false);
    }
  };

  const toggleRecipientActive = async (recipient: AlertRecipient) => {
    const verified = recipient.verification_status === "verified";
    if (!verified) {
      pushAppToast({
        title: "Verification required",
        description: "Verify number before enabling alerts.",
        tone: "info",
      });
      return;
    }
    setTogglePendingId(recipient.id);
    try {
      await updateAlertRecipient(recipient.id, { is_active: !recipient.is_active });
      await loadRecipients();
      pushAppToast({
        title: recipient.is_active ? "Alerts paused" : "Alerts enabled",
        description: recipient.is_active
          ? "This recipient will stop receiving live alerts until re-enabled."
          : "This recipient can now receive live alerts.",
        tone: "success",
      });
    } catch (error) {
      const message = formatApiErrorMessage(error, "Could not update recipient status.");
      pushAppToast({
        title: "Activation failed",
        description: `${message} Previous state was kept. Retry when ready.`,
        tone: "error",
      });
    } finally {
      setTogglePendingId(null);
    }
  };

  const removeRecipient = async (recipient: AlertRecipient) => {
    if (!window.confirm(`Delete ${maskPhoneNumber(recipient.phone_e164 || recipient.phone_number)} from alert delivery?`)) {
      return;
    }
    setDeletePendingId(recipient.id);
    try {
      await deleteAlertRecipient(recipient.id);
      if (panel.open && panel.recipientId === recipient.id) {
        closePanel();
      }
      await loadRecipients();
      pushAppToast({
        title: "Recipient deleted",
        description: "The number was removed from alert delivery.",
        tone: "success",
      });
    } catch (error) {
      const message = formatApiErrorMessage(error, "Could not delete recipient.");
      pushAppToast({
        title: "Delete failed",
        description: `${message} Previous state was kept. Retry when ready.`,
        tone: "error",
      });
    } finally {
      setDeletePendingId(null);
    }
  };

  const startVerification = async (recipient: AlertRecipient, fromModal = false) => {
    const cooldownSeconds = getCooldownSeconds(recipient.id);
    if (cooldownSeconds > 0) {
      const message = `Verification is cooling down. Retry in ${formatCountdown(cooldownSeconds)}.`;
      if (fromModal) {
        setVerificationModal((current) => ({ ...current, error: message }));
      } else {
        pushAppToast({
          title: "Please wait",
          description: message,
          tone: "info",
        });
      }
      return;
    }
    setVerifyPendingId(recipient.id);
    if (fromModal) {
      setVerificationModal((current) => ({ ...current, error: "", submitting: false }));
    }
    try {
      const result = await startAlertRecipientVerification(recipient.id, recipient.phone_e164 || recipient.phone_number);
      setVerificationModal({
        open: true,
        recipientId: recipient.id,
        phone: recipient.phone_e164 || recipient.phone_number,
        maskedPhone: result.masked_phone,
        otp: "",
        expiresAt: Date.now() + result.expires_in * 1000,
        submitting: false,
        error: "",
      });
      pushAppToast({
        title: "Verification code sent",
        description: `A fresh OTP was sent to ${result.masked_phone}.`,
        tone: "success",
      });
    } catch (error) {
      const detail = detailFromError(error);
      if (detail?.retry_after) {
        applyCooldown(recipient.id, detail.retry_after);
      }
      const message = mapVerificationError(error);
      if (fromModal) {
        setVerificationModal((current) => ({ ...current, error: message }));
      }
      pushAppToast({
        title: "OTP request failed",
        description: message,
        tone: "error",
      });
    } finally {
      setVerifyPendingId(null);
    }
  };

  const submitVerificationCode = async () => {
    if (!verificationModal.recipientId || !verificationModal.phone.trim()) return;
    const otp = verificationModal.otp.trim();
    if (otp.length !== 6) {
      setVerificationModal((current) => ({ ...current, error: "Enter the 6-digit OTP to continue." }));
      return;
    }
    setVerificationModal((current) => ({ ...current, submitting: true, error: "" }));
    try {
      await confirmAlertRecipientVerification(verificationModal.recipientId, verificationModal.phone, otp);
      await loadRecipients();
      setVerificationModal({
        open: false,
        recipientId: null,
        phone: "",
        maskedPhone: "",
        otp: "",
        expiresAt: null,
        submitting: false,
        error: "",
      });
      pushAppToast({
        title: "Recipient verified",
        description: "The number is now trusted and can be enabled for live alerts.",
        tone: "success",
      });
    } catch (error) {
      const message = mapVerificationError(error);
      const detail = detailFromError(error);
      if (detail?.retry_after && verificationModal.recipientId) {
        applyCooldown(verificationModal.recipientId, detail.retry_after);
      }
      if (detail?.code === "otp_expired" || detail?.code === "max_attempts_reached" || detail?.code === "no_active_otp") {
        void loadRecipients();
      }
      setVerificationModal((current) => ({ ...current, submitting: false, error: message }));
      pushAppToast({
        title: "Verification failed",
        description: message,
        tone: "error",
      });
    }
  };

  const verificationSecondsLeft =
    verificationModal.expiresAt != null ? Math.max(0, Math.ceil((verificationModal.expiresAt - nowTs) / 1000)) : 0;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="text-sm text-[var(--muted)]">Active recipients</div>
            <CardTitle>{recipientPayload?.active_count ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted)]">
            {recipientPayload ? `${recipientPayload.plan} plan · ${recipientPayload.limit} active slot${recipientPayload.limit === 1 ? "" : "s"} total` : "Track who can currently receive live alerts."}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="text-sm text-[var(--muted)]">Remaining capacity</div>
            <CardTitle>
              {recipientPayload ? Math.max(0, recipientPayload.limit - recipientPayload.active_count) : "-"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--muted)]">
            Unverified numbers do not count as live delivery targets until they are activated.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="text-sm text-[var(--muted)]">Last alert sent</div>
            <CardTitle className="text-xl">{latestAlert ? readableDeliveryStatus(latestAlert.delivery_status) : "No recent alert"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-[var(--muted)]">
            <div>{latestAlert ? formatAlertEventTypeLabel(latestAlert.event_type) : "Alert activity will appear here once delivery starts."}</div>
            <div>{latestAlert ? formatDateTime(latestAlert.timestamp) : "Keep recipients verified and active to build delivery history."}</div>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="min-w-0">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">WhatsApp Recipients</CardTitle>
              <div className="mt-2 text-sm text-[var(--muted)]">
                Decide who receives critical factory alerts, what they get, and whether each route is trusted.
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void loadRecipients()} disabled={recipientsLoading}>
                {recipientsLoading ? "Refreshing..." : "Refresh"}
              </Button>
              <Button onClick={openAddModal}>Add Number</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {recipientsLoading && !recipientsLoaded ? (
              <div className="space-y-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="rounded-[28px] border border-[var(--border)] bg-[var(--card-strong)] p-5">
                    <Skeleton className="h-6 w-40" />
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recipientsError ? (
              <div className="rounded-[28px] border border-red-500/25 bg-red-500/8 p-5 text-sm text-red-100">
                <div className="font-semibold">Could not load recipients</div>
                <div className="mt-2">{recipientsError}</div>
                <div className="mt-4">
                  <Button variant="outline" onClick={() => void loadRecipients()}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : recipients.length ? (
              <div className="space-y-4">
                {recipients.map((recipient) => {
                  const verified = recipient.verification_status === "verified";
                  const toggleDisabled = !verified || togglePendingId === recipient.id;
                  const cooldownSeconds = getCooldownSeconds(recipient.id);
                  const verifyLabel =
                    verifyPendingId === recipient.id
                      ? "Sending..."
                      : cooldownSeconds > 0
                        ? `Retry in ${formatCountdown(cooldownSeconds)}`
                        : verified
                          ? "Re-verify"
                          : "Verify";
                  return (
                    <div key={recipient.id} className="rounded-[28px] border border-[var(--border)] bg-[var(--card-strong)] p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <SafeText as="div" className="text-lg font-semibold text-white">
                              {maskPhoneNumber(recipient.phone_e164 || recipient.phone_number)}
                            </SafeText>
                            <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", verificationStatusTone(recipient.verification_status))}>
                              {recipient.verification_status}
                            </span>
                            <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", recipient.is_active ? "border-emerald-400/30 bg-emerald-500/12 text-emerald-200" : "border-[var(--border)] bg-white/5 text-[var(--muted)]")}>
                              {recipient.is_active ? "Active" : "Paused"}
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(8,14,24,0.6)] p-4">
                              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Receives</div>
                              <div className="mt-2 text-sm font-medium text-white">{summarizeRecipientCategories(recipient)}</div>
                            </div>
                            <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(8,14,24,0.6)] p-4">
                              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Verified at</div>
                              <div className="mt-2 text-sm font-medium text-white">{formatDateTime(recipient.verified_at)}</div>
                            </div>
                            <div className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(8,14,24,0.6)] p-4">
                              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Safety rule</div>
                              <div className="mt-2 text-sm font-medium text-white">
                                {verified ? "Eligible for live alerts" : "Verify number before enabling alerts"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="w-full max-w-sm space-y-3 rounded-[24px] border border-[var(--border)] bg-[rgba(7,10,18,0.76)] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Live delivery</div>
                              <div className="mt-1 text-sm text-white">{recipient.is_active ? "Enabled" : "Disabled"}</div>
                            </div>
                            <span title={!verified ? "Verify number before enabling alerts" : ""}>
                              <button
                                type="button"
                                aria-label={recipient.is_active ? "Disable alerts" : "Enable alerts"}
                                onClick={() => void toggleRecipientActive(recipient)}
                                disabled={toggleDisabled}
                                className={cn(
                                  "relative inline-flex h-8 w-14 items-center rounded-full border transition",
                                  recipient.is_active ? "border-emerald-400/40 bg-emerald-500/20" : "border-[var(--border)] bg-white/5",
                                  toggleDisabled && "cursor-not-allowed opacity-60",
                                )}
                              >
                                <span
                                  className={cn(
                                    "inline-block h-6 w-6 rounded-full bg-white shadow transition",
                                    recipient.is_active ? "translate-x-7" : "translate-x-1",
                                  )}
                                />
                              </button>
                            </span>
                          </div>
                          {!verified ? (
                            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                              Verify number before enabling alerts.
                            </div>
                          ) : null}
                          <div className="grid gap-2 sm:grid-cols-3">
                            <Button
                              variant="outline"
                              onClick={() => void startVerification(recipient)}
                              disabled={verifyPendingId === recipient.id || cooldownSeconds > 0}
                              title={cooldownSeconds > 0 ? "Retry once cooldown ends." : ""}
                              className="w-full"
                            >
                              {verifyLabel}
                            </Button>
                            <Button variant="outline" onClick={() => void openEditModal(recipient.id)} className="w-full">
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => void removeRecipient(recipient)}
                              disabled={deletePendingId === recipient.id}
                              className="w-full text-red-100"
                            >
                              {deletePendingId === recipient.id ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[30px] border border-dashed border-[var(--border-strong)] bg-[rgba(11,16,26,0.6)] px-6 py-10 text-center">
                <div className="text-lg font-semibold text-white">No alert recipients yet.</div>
                <div className="mt-2 text-sm text-[var(--muted)]">
                  Add a number to start receiving critical factory alerts.
                </div>
                <div className="mt-5">
                  <Button onClick={openAddModal}>Add Number</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Alert Configuration Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                Each recipient can have independent subscriptions so critical alerts reach the right people without spam.
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                Critical and warning groups map to the existing severity filters. Security maps to the current anomaly alert type.
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                Machine downtime routing is reserved for future backend support and is shown as coming soon in v1.
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl">Activity / Logs</CardTitle>
                <div className="mt-2 text-sm text-[var(--muted)]">
                  Recent org-wide alert events build trust and make delivery problems visible.
                </div>
              </div>
              <Button variant="outline" onClick={() => void loadActivity()} disabled={activityLoading}>
                {activityLoading ? "Refreshing..." : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {activityLoading && !activityLoaded ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="mt-3 h-4 w-full" />
                      <Skeleton className="mt-2 h-4 w-2/3" />
                    </div>
                  ))}
                </div>
              ) : activityError ? (
                <div className="rounded-[28px] border border-red-500/25 bg-red-500/8 p-5 text-sm text-red-100">
                  <div className="font-semibold">Could not load alert activity</div>
                  <div className="mt-2">{activityError}</div>
                  <div className="mt-4">
                    <Button variant="outline" onClick={() => void loadActivity()}>
                      Retry
                    </Button>
                  </div>
                </div>
              ) : activityRows.length ? (
                <>
                  <ResponsiveScrollArea debugLabel="settings-alert-activity" viewportClassName="-mx-1 px-1 pb-2">
                    <div className="space-y-3">
                      {activityRows.map((alert) => (
                        <button
                          key={`${alert.ref_id}:${alert.recipient_phone || "root"}`}
                          type="button"
                          onClick={() => void loadAlertDetail(alert.ref_id)}
                          className={cn(
                            "w-full rounded-2xl border p-4 text-left transition hover:border-sky-300/30 hover:bg-[rgba(62,166,255,0.05)]",
                            selectedAlertRef === alert.ref_id ? "border-sky-300/35 bg-[rgba(62,166,255,0.08)]" : "border-[var(--border)] bg-[var(--card-strong)]",
                          )}
                        >
                          <div className="flex flex-wrap items-start gap-3">
                            <span className={cn("rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", severityTone(alert.severity))}>
                              {alert.severity}
                            </span>
                            <span className={cn("rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", deliveryTone(alert.delivery_status))}>
                              {readableDeliveryStatus(alert.delivery_status)}
                            </span>
                            <span className="text-xs text-[var(--muted)]">{formatDateTime(alert.timestamp)}</span>
                          </div>
                          <div className="mt-3 text-sm font-semibold text-white">{formatAlertEventTypeLabel(alert.event_type)}</div>
                          <div className="mt-2 text-sm text-[var(--muted)]">{alert.summary}</div>
                        </button>
                      ))}
                    </div>
                  </ResponsiveScrollArea>

                  {selectedAlertRef ? (
                    <div className="rounded-[28px] border border-[var(--border)] bg-[rgba(8,12,20,0.84)] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">Alert delivery detail</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">Selected ref: {selectedAlertRef}</div>
                        </div>
                        {selectedAlertError ? (
                          <Button variant="outline" onClick={() => void loadAlertDetail(selectedAlertRef)}>
                            Retry
                          </Button>
                        ) : null}
                      </div>

                      {selectedAlertLoading ? (
                        <div className="mt-4 space-y-3">
                          <Skeleton className="h-5 w-40" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      ) : selectedAlertError ? (
                        <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/8 p-4 text-sm text-red-100">
                          {selectedAlertError}
                        </div>
                      ) : selectedAlert ? (
                        <div className="mt-4 space-y-4">
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                            <div className="flex flex-wrap gap-3">
                              <span className={cn("rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", severityTone(selectedAlert.severity))}>
                                {selectedAlert.severity}
                              </span>
                              <span className={cn("rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", deliveryTone(selectedAlert.delivery_status))}>
                                {readableDeliveryStatus(selectedAlert.delivery_status)}
                              </span>
                            </div>
                            <div className="mt-3 text-sm font-semibold text-white">{selectedAlert.summary}</div>
                            <div className="mt-2 text-xs text-[var(--muted)]">
                              {formatAlertEventTypeLabel(selectedAlert.event_type)} · {formatDateTime(selectedAlert.timestamp)}
                            </div>
                          </div>
                          <div className="space-y-3">
                            {selectedAlert.deliveries.length ? (
                              selectedAlert.deliveries.map((delivery, index) => (
                                <div key={`${delivery.ref_id}:${delivery.recipient_phone || index}`} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                                  <div className="flex flex-wrap items-center gap-3">
                                    <span className={cn("rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", deliveryTone(delivery.delivery_status))}>
                                      {readableDeliveryStatus(delivery.delivery_status)}
                                    </span>
                                    <span className="text-xs text-[var(--muted)]">{maskPhoneNumber(delivery.recipient_phone)}</span>
                                  </div>
                                  <div className="mt-2 text-xs text-[var(--muted)]">
                                    {delivery.suppressed_reason ? `Reason: ${readableDeliveryStatus(delivery.suppressed_reason)}` : "No suppression reason recorded."}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                                No per-recipient delivery rows were recorded for this alert.
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-[28px] border border-dashed border-[var(--border-strong)] bg-[rgba(11,16,26,0.6)] px-6 py-10 text-center">
                  <div className="text-lg font-semibold text-white">No alert activity yet.</div>
                  <div className="mt-2 text-sm text-[var(--muted)]">
                    Once alerts are triggered, the latest delivery status and timestamps will appear here.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ActionModal
        open={panel.open}
        title={panel.mode === "add" ? "Add WhatsApp Recipient" : "Edit Alert Recipient"}
        subtitle={
          panel.mode === "add"
            ? "New numbers are saved as pending. Verification must complete before alerts can be enabled."
            : "Full phone number is only shown inside this editor to reduce screenshot and shoulder-surfing risk."
        }
        onClose={closePanel}
      >
        {panelLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="text-sm text-[var(--muted)]">Phone number</label>
              <Input
                value={form.phone_number}
                onChange={(event) => setForm((current) => ({ ...current, phone_number: event.target.value }))}
                placeholder="+919876543210"
              />
              <div className="mt-2 text-xs text-[var(--muted)]">
                This is the only place where the full number is shown.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                {
                  key: "critical",
                  title: "Critical Alerts",
                  description: "High and critical severity operational alerts.",
                  disabled: false,
                },
                {
                  key: "warning",
                  title: "Warning Alerts",
                  description: "Low and medium severity factory warning signals.",
                  disabled: false,
                },
                {
                  key: "security",
                  title: "Security Alerts",
                  description: "Authentication anomaly and access-risk alerts.",
                  disabled: false,
                },
                {
                  key: "reports",
                  title: "Reports",
                  description: "Daily summary messages and periodic rollups.",
                  disabled: false,
                },
                {
                  key: "machineDowntime",
                  title: "Machine Downtime",
                  description: "Reserved for future backend-supported routing.",
                  disabled: true,
                },
              ].map((item) => {
                const checked = form.categories[item.key as keyof AlertCategoryState];
                return (
                  <label
                    key={item.key}
                    className={cn(
                      "rounded-[24px] border p-4 transition",
                      item.disabled ? "border-[var(--border)]/60 bg-[rgba(255,255,255,0.03)] opacity-70" : "border-[var(--border)] bg-[var(--card-strong)] hover:border-sky-300/25",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{item.title}</div>
                        <div className="mt-2 text-sm text-[var(--muted)]">{item.description}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={item.disabled}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            categories: {
                              ...current.categories,
                              [item.key]: event.target.checked,
                            },
                          }))
                        }
                        className="mt-1 h-4 w-4 accent-[var(--accent)]"
                      />
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card-strong)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Active delivery</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    Keep this off until the route is verified and ready for live alerts.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  disabled={panel.mode === "add" || !!(selectedRecipient && selectedRecipient.verification_status !== "verified")}
                  onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                  className="h-4 w-4 accent-[var(--accent)]"
                  title={
                    panel.mode === "add" || !!(selectedRecipient && selectedRecipient.verification_status !== "verified")
                      ? "Verify number before enabling alerts"
                      : ""
                  }
                />
              </div>
              {panel.mode === "add" || !!(selectedRecipient && selectedRecipient.verification_status !== "verified") ? (
                <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  Verify number before enabling alerts.
                </div>
              ) : null}
            </div>

            {panelError ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-100">
                {panelError}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={closePanel} disabled={panelSubmitting}>
                Cancel
              </Button>
              <Button onClick={() => void savePanel()} disabled={panelSubmitting}>
                {panelSubmitting ? "Saving..." : panel.mode === "add" ? "Save Recipient" : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </ActionModal>

      <ActionModal
        open={verificationModal.open}
        title="Verify Alert Recipient"
        subtitle={`OTP is sent only when needed. Keep this route trusted before enabling live alerts.`}
        onClose={() =>
          setVerificationModal({
            open: false,
            recipientId: null,
            phone: "",
            maskedPhone: "",
            otp: "",
            expiresAt: null,
            submitting: false,
            error: "",
          })
        }
      >
        <div className="space-y-5">
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card-strong)] p-4">
            <div className="text-sm font-semibold text-white">Destination</div>
            <div className="mt-2 text-sm text-[var(--muted)]">{verificationModal.maskedPhone || "Masked phone will appear here once OTP is sent."}</div>
            <div className="mt-3 text-xs text-[var(--muted)]">
              Code expires in {formatCountdown(verificationSecondsLeft)}.
            </div>
          </div>

          <div>
            <label className="text-sm text-[var(--muted)]">Enter OTP</label>
            <Input
              value={verificationModal.otp}
              maxLength={6}
              inputMode="numeric"
              onChange={(event) =>
                setVerificationModal((current) => ({
                  ...current,
                  otp: event.target.value.replace(/\D/g, "").slice(0, 6),
                }))
              }
              placeholder="6-digit code"
            />
          </div>

          {verificationModal.error ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-100">
              {verificationModal.error}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => {
                const recipient = recipients.find((item) => item.id === verificationModal.recipientId);
                if (recipient) {
                  void startVerification(recipient, true);
                }
              }}
              disabled={
                verificationModal.submitting ||
                !verificationModal.recipientId ||
                (verificationModal.recipientId ? getCooldownSeconds(verificationModal.recipientId) > 0 : false)
              }
              title={
                verificationModal.recipientId && getCooldownSeconds(verificationModal.recipientId) > 0
                  ? "Wait for the cooldown to finish before requesting another code."
                  : ""
              }
            >
              {verificationModal.recipientId && getCooldownSeconds(verificationModal.recipientId) > 0
                ? `Retry in ${formatCountdown(getCooldownSeconds(verificationModal.recipientId))}`
                : "Resend Code"}
            </Button>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  setVerificationModal({
                    open: false,
                    recipientId: null,
                    phone: "",
                    maskedPhone: "",
                    otp: "",
                    expiresAt: null,
                    submitting: false,
                    error: "",
                  })
                }
                disabled={verificationModal.submitting}
              >
                Cancel
              </Button>
              <Button onClick={() => void submitVerificationCode()} disabled={verificationModal.submitting}>
                {verificationModal.submitting ? "Verifying..." : "Confirm Verification"}
              </Button>
            </div>
          </div>
        </div>
      </ActionModal>
    </div>
  );
}
