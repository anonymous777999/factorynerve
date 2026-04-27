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
      <div className="text-sm font-medium text-[#101828]">Share link</div>
      <div className="mt-1 text-sm text-[#667085]">
        7-day read-only export link
      </div>
      {link ? (
        <div className="mt-3">
          <div className="truncate rounded-[16px] border border-[#e5ebf1] bg-[#f8fafc] px-3 py-2 text-sm text-[#344054]">
            {link}
          </div>
          {expiresAt ? (
            <div className="mt-2 text-xs text-[#667085]">
              Expires {formatExpiry(expiresAt)}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-full border border-[#d9e1e8] bg-[#f9fbfd] px-4 py-2 text-sm font-medium text-[#344054] transition hover:border-[#185FA5]/35 hover:text-[#185FA5] disabled:opacity-45"
          disabled={busy}
          onClick={onGenerate}
        >
          {busy ? "Generating..." : link ? "Refresh link" : "Generate link"}
        </button>
        {link ? (
          <button
            type="button"
            className="rounded-full bg-[#185FA5] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#164f8a]"
            onClick={onCopy}
          >
            Copy
          </button>
        ) : null}
      </div>
    </div>
  );
}
