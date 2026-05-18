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
  return typeof code === "string" ? code : "";
}

export function resolveApiError(context: ApiErrorHandlerContext): ApiErrorResolution {
  if (context.status === 404) {
    return { action: "ignore" };
  }

  if (context.status !== 403) {
    return { action: "ignore" };
  }

  const code = detailCode(context.detail);
  if (code === "SESSION_UPDATED") {
    return { action: "redirect", href: "/access?reason=permissions_updated" };
  }
  if (code === "SUSPENDED") {
    return { action: "redirect", href: "/suspended" };
  }
  if (code === "INSUFFICIENT_RANK") {
    return {
      action: "toast",
      title: "Action not permitted",
      description: "Action not permitted for your role",
    };
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
