import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ImagePreviewProps = {
  src: string;
  alt: string;
  badge?: string;
  title?: string;
  subtitle?: string;
  overlay?: ReactNode;
  className?: string;
};

export function ImagePreview({
  src,
  alt,
  badge,
  title,
  subtitle,
  overlay,
  className,
}: ImagePreviewProps) {
  return (
    <div className={cn("overflow-hidden rounded-[28px] border border-[#e7eaee] bg-white", className)}>
      {(badge || title || subtitle) ? (
        <div className="border-b border-[#eff2f5] px-4 py-4">
          {badge ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a93a0]">
              {badge}
            </div>
          ) : null}
          {title ? <div className="mt-1 text-lg font-semibold text-[#101418]">{title}</div> : null}
          {subtitle ? <div className="mt-1 text-sm text-[#66707c]">{subtitle}</div> : null}
        </div>
      ) : null}
      <div className="relative grid min-h-[18rem] place-items-center bg-[#f6f7f8]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-[68vh] w-full object-contain" />
        {overlay}
      </div>
    </div>
  );
}
