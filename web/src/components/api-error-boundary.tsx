"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { invalidateAuthCache } from "@/lib/auth";
import {
  registerApiErrorHandler,
  type ApiErrorHandlerContext,
} from "@/lib/api";
import { pushAppToast } from "@/lib/toast";

type ApiErrorResolution =
  | { action: "redirect"; href: string }
  | { action: "toast"; title: string; description: string }
  | { action: "ignore" };

function detailCode(detail: unknown) {
  if (!detail || typeof detail !== "object") {
    return "";
  }
  const code = "code" in detail ? (detail as { code?: unknown }).code : undefined;
  if (typeof code === "string") {
    return code;
  }
  const nestedDetail =
    "detail" in detail ? (detail as { detail?: unknown }).detail : undefined;
  return detailCode(nestedDetail);
}

export function shouldGloballyRedirect(
  status: number,
  code: string,
  requestPath: string,
): boolean {
  if (status === 402) {
    return false;
  }

  if (status !== 403) {
    return false;
  }

  if (code === "SESSION_UPDATED" || code === "SUSPENDED") {
    return true;
  }

  if (
    code === "NO_SUBSCRIPTION" ||
    code === "FEATURE_GATED" ||
    code === "INSUFFICIENT_RANK" ||
    code === "TARGET_OUTRANKS_YOU"
  ) {
    return false;
  }

  return requestPath === "/auth/me" || requestPath === "/auth/context" || requestPath === "/auth/refresh";
}

export function resolveApiError(context: ApiErrorHandlerContext): ApiErrorResolution {
  if (context.status === 404) {
    return { action: "ignore" };
  }

  if (context.status === 402) {
    return { action: "ignore" };
  }

  if (context.status !== 403) {
    return { action: "ignore" };
  }

  const code = context.code || detailCode(context.detail);
  if (code === "SESSION_UPDATED") {
    return { action: "redirect", href: "/access?reason=permissions_updated" };
  }
  if (code === "SUSPENDED") {
    return { action: "redirect", href: "/suspended" };
  }
  if (code === "INSUFFICIENT_RANK" || code === "TARGET_OUTRANKS_YOU") {
    return {
      action: "toast",
      title: "Action not permitted",
      description: "Action not permitted for your role",
    };
  }

  if (code === "NO_SUBSCRIPTION" || code === "FEATURE_GATED") {
    return { action: "ignore" };
  }

  if (!shouldGloballyRedirect(context.status, code, context.path)) {
    return { action: "ignore" };
  }

  return { action: "redirect", href: "/403" };
}

export function ApiErrorBoundary() {
  const router = useRouter();

  useEffect(() => {
    registerApiErrorHandler(async (context) => {
      const resolution = resolveApiError(context);
      if (resolution.action === "ignore") {
        return;
      }
      if (resolution.action === "toast") {
        pushAppToast({
          title: resolution.title,
          description: resolution.description,
          tone: "error",
        });
        return;
      }
      if (resolution.href === "/access?reason=permissions_updated") {
        invalidateAuthCache();
      }
      router.push(resolution.href);
    });

    return () => {
      registerApiErrorHandler(null);
    };
  }, [router]);

  return null;
}
