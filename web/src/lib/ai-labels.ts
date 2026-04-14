function startCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function providerDisplayName(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "groq") return "Groq";
  if (normalized === "anthropic" || normalized === "claude") return "Anthropic";
  if (normalized === "openai" || normalized === "gpt") return "OpenAI";
  if (normalized === "fallback") return "Manual fallback";
  return startCase(value);
}

export function humanizeAiProvider(provider?: string | null) {
  if (!provider) return "Managed AI drafting";
  const parts = provider
    .split("->")
    .map((item) => providerDisplayName(item))
    .filter(Boolean);
  if (!parts.length) return "Managed AI drafting";
  if (parts.length === 1) return `${parts[0]} service`;
  return `${parts[0]} service with ${parts.slice(1).join(" and ")} fallback`;
}

export function humanizeAiStatus(provider?: string | null) {
  if (!provider) return "Managed AI draft is ready.";
  const parts = provider
    .split("->")
    .map((item) => providerDisplayName(item))
    .filter(Boolean);
  if (!parts.length) return "Managed AI draft is ready.";
  if (parts.length === 1) return `${parts[0]} draft is ready.`;
  return `${parts[0]} draft is ready with automatic backup routing.`;
}

export function humanizePlanLabel(plan?: string | null) {
  if (!plan) return "-";
  return startCase(plan);
}
