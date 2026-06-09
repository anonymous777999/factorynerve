type ShareLinkGeneratorProps = {
  busy?: boolean;
  link?: string | null;
  expiresAt?: string | null;
  onGenerate: () => void;
  onCopy?: () => void;
};

function formatExpiry(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ShareLinkGenerator({
  busy = false,
  link,
  expiresAt,
  onGenerate,
  onCopy,
}: ShareLinkGeneratorProps) {
  return (
    <div className="rounded-[22px] border border-[#dce5ee] bg-white p-4">
      <div className="text-sm font-medium text-text-primary">Share link</div>
      <div className="mt-1 text-sm text-text-secondary">
        7-day read-only export link
      </div>
      {link ? (
        <div className="mt-3">
          <div className="truncate rounded-[16px] border border-[#e5ebf1] bg-surface-shell px-3 py-2 text-sm text-text-primary">
            {link}
          </div>
          {expiresAt ? (
            <div className="mt-2 text-xs text-text-secondary">
              Expires {formatExpiry(expiresAt)}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-full border border-border-subtle bg-surface-shell px-4 py-2 text-sm font-medium text-text-primary transition hover:border-accent/35 hover:text-accent disabled:opacity-45"
          disabled={busy}
          onClick={onGenerate}
        >
          {busy ? "Generating..." : link ? "Refresh link" : "Generate link"}
        </button>
        {link ? (
          <button
            type="button"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
            onClick={onCopy}
          >
            Copy
          </button>
        ) : null}
      </div>
    </div>
  );
}
