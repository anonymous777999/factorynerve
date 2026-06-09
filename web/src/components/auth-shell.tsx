"use client";

import type { ReactNode } from "react";
import { Lock, Mail, ShieldCheck } from "lucide-react";

import { AuthWorkstationShell, type AuthWorkstationStep } from "@/components/auth-workstation-shell";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  badge: string;
  title: string;
  description: string;
  journeyTitle: string;
  journeyDescription: string;
  steps: AuthWorkstationStep[];
  supportTitle?: string;
  supportDescription?: string;
  children: ReactNode;
  cardClassName?: string;
  contentClassName?: string;
};

export function AuthShell({
  badge,
  title,
  description,
  journeyTitle,
  journeyDescription,
  steps,
  supportTitle,
  supportDescription,
  children,
  cardClassName,
  contentClassName,
}: AuthShellProps) {
  const { t } = useI18n();
  useI18nNamespaces(["auth", "common"]);

  const resolvedSupportTitle = supportTitle || t("auth.shell.support_title", "Factory-safe account flow");
  const resolvedSupportDescription =
    supportDescription ||
    t(
      "auth.shell.support_description",
      "Every auth step is designed to protect the workspace, verify inbox ownership, and keep access traceable.",
    );

  return (
    <AuthWorkstationShell
      sidePanel="minimal"
      badge={badge}
      title={title}
      description={description}
      leftEyebrow={t("auth.shell.guardrails", "Guardrails")}
      leftTitle={journeyTitle}
      leftDescription={journeyDescription}
      steps={steps}
      supportTitle={resolvedSupportTitle}
      supportDescription={resolvedSupportDescription}
      supportItems={[
        {
          icon: <ShieldCheck className="h-4 w-4" />,
          text: "Credential activation remains locked behind verified inbox ownership.",
        },
        {
          icon: <Lock className="h-4 w-4" />,
          text: "Factory-safe session rules keep access traceable before any workspace opens.",
        },
        {
          icon: <Mail className="h-4 w-4" />,
          text: "Recovery and verification always route through the same controlled email channel.",
        },
      ]}
      panelClassName={cardClassName}
      contentClassName={cn("space-y-5", contentClassName)}
    >
      {children}
    </AuthWorkstationShell>
  );
}
