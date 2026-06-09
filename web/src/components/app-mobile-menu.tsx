"use client";

type TranslateFn = (key: string, fallback?: string) => string;

export function AppMobileMenu({
  isOpen,
  onClose,
  translate,
}: {
  isOpen: boolean;
  onClose: () => void;
  translate?: TranslateFn;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label={translate ? translate("shell.close_sidebar_overlay", "Close sidebar overlay") : "Close sidebar overlay"}
      className="fixed inset-0 z-30 bg-[rgba(3,8,20,0.55)] lg:hidden"
      onClick={onClose}
    />
  );
}
