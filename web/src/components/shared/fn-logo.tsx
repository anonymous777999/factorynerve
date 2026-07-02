"use client";

import { cn } from "@/lib/utils";

type FnLogoVariant =
  | "mark"          // FN icon mark only
  | "mark-light"    // FN icon mark for light backgrounds
  | "mono-white"    // FN icon mark monochrome white
  | "mono-black"    // FN icon mark monochrome black
  | "horizontal"    // Full horizontal logo: FN mark + "FactoryNerve" + tagline
  | "horizontal-simple" // Horizontal without tagline
  | "stacked"       // Stacked vertical logo
  | "wordmark"      // "FactoryNerve" text only (dark)
  | "wordmark-light"; // "FactoryNerve" text only (light)

interface FnLogoProps {
  variant?: FnLogoVariant;
  className?: string;
  width?: number | string;
  height?: number | string;
}

const brandNavy = "#081C3A";
const brandBlue = "#1D4ED8";
const brandAccent = "#3B82F6";
const brandGray = "#5B6575";

/**
 * FN Icon Mark — the core "F" + "N" monogram.
 * viewBox 0 0 200 200.
 */
function FnMark({ fill }: { fill: "default" | "light" | "white" | "black" }) {
  const fColor =
    fill === "default"
      ? "url(#fn-whiteGrad)"
      : fill === "light"
        ? brandNavy
        : fill === "white"
          ? "#FFFFFF"
          : "#000000";
  const nColor =
    fill === "default" || fill === "light"
      ? "url(#fn-blueGrad)"
      : fill === "white"
        ? "#FFFFFF"
        : "#000000";
  const dotColor = fill === "default" || fill === "light" ? brandAccent : fill === "white" ? "#FFFFFF" : "#000000";

  const showLine = fill === "default" || fill === "light";
  const lineColor = fill === "default" ? brandAccent : fill === "light" ? brandBlue : "transparent";

  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fn-whiteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#CBD5E0" />
        </linearGradient>
        <linearGradient id="fn-blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
        <filter id="fn-shadow">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#1D4ED8" floodOpacity="0.3" />
        </filter>
        <filter id="fn-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* F shape */}
      <path
        d="M 30 25 L 115 25 L 95 55 L 65 55 L 65 88 L 92 88 L 78 118 L 65 118 L 65 175 L 30 175 Z"
        fill={fColor}
        filter={fill === "default" ? "url(#fn-shadow)" : undefined}
      />
      {/* N shape */}
      <path
        d="M 95 25 L 130 25 L 145 115 L 145 25 L 180 25 L 180 175 L 145 175 L 125 88 L 125 175 L 95 175 Z"
        fill={nColor}
        filter={fill === "default" ? "url(#fn-glow)" : undefined}
      />
      {/* Center dot */}
      <circle cx="100" cy="100" r="3" fill={dotColor} opacity={0.9} />
      {/* Dashed connecting line between F and N */}
      {showLine ? (
        <line x1="65" y1="100" x2="95" y2="100" stroke={lineColor} strokeWidth="1" opacity="0.6" strokeDasharray="2,2" />
      ) : null}
    </svg>
  );
}

/** FN mark path data reused across variants */
/** Horizontal gradient used for "Nerve" text in logos (left→right) */
const FN_BLUE_TEXT_GRADIENT_ID = "fn-blueTextGrad";
const FN_BLUE_GRADIENT_ID = "fn-blueGrad";

const FN_F_PATH = "M 30 25 L 115 25 L 95 55 L 65 55 L 65 88 L 92 88 L 78 118 L 65 118 L 65 175 L 30 175 Z";
const FN_N_PATH = "M 95 25 L 130 25 L 145 115 L 145 25 L 180 25 L 180 175 L 145 175 L 125 88 L 125 175 L 95 175 Z";

/** Shared <defs> for horizontal-logo SVGs (dark). Adds text glow on "Nerve". */
function LogoDefs({ withTextGlow }: { withTextGlow: boolean }) {
  return (
    <defs>
      <linearGradient id="fn-whiteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#CBD5E0" />
      </linearGradient>
      <linearGradient id={FN_BLUE_GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3B82F6" />
        <stop offset="50%" stopColor="#1D4ED8" />
        <stop offset="100%" stopColor="#1E40AF" />
      </linearGradient>
      <linearGradient id={FN_BLUE_TEXT_GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#1D4ED8" />
        <stop offset="100%" stopColor="#3B82F6" />
      </linearGradient>
      {withTextGlow ? (
        <filter id="fn-textGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      ) : null}
    </defs>
  );
}

/** FN mark paths used inside horizontal/stacked logos (no wrapping <svg>) */
function FnMarkPaths({ fColor, nColor, dotColor, lineColor }: { fColor: string; nColor: string; dotColor: string; lineColor: string }) {
  return (
    <>
      <path d={FN_F_PATH} fill={fColor} />
      <path d={FN_N_PATH} fill={nColor} />
      <circle cx="100" cy="100" r="3" fill={dotColor} opacity={0.9} />
      <line x1="65" y1="100" x2="95" y2="100" stroke={lineColor} strokeWidth="1" opacity="0.6" strokeDasharray="2,2" />
    </>
  );
}

/**
 * Horizontal logo: FN mark + "FactoryNerve" text + optional tagline.
 * viewBox 0 0 1000 200.
 */
function HorizontalLogo({ variant }: { variant: "dark" | "light" | "simple" }) {
  const isLight = variant === "light";
  const isSimple = variant === "simple";
  const textColor = isLight ? brandNavy : "#FFFFFF";
  const taglineColor = isLight ? "#475569" : brandGray;
  const dotColor = isLight ? brandBlue : brandAccent;
  const fMarkColor = isLight ? brandNavy : "url(#fn-whiteGrad)";
  const nMarkColor = `url(#${FN_BLUE_GRADIENT_ID})`;
  const nerveGrad = `url(#${FN_BLUE_TEXT_GRADIENT_ID})`;
  const markDotColor = brandAccent;
  const nerveFilter = isLight ? undefined : "url(#fn-textGlow)";
  const lineColor = isLight ? brandBlue : brandAccent;

  // Simple variant has no tagline, larger text
  if (isSimple) {
    return (
      <svg viewBox="0 0 900 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <LogoDefs withTextGlow />
        <g transform="matrix(0.7 0 0 0.7 30 28)">
          <FnMarkPaths fColor="url(#fn-whiteGrad)" nColor={nMarkColor} dotColor={markDotColor} lineColor={lineColor} />
        </g>
        <line x1="220" y1="40" x2="220" y2="160" stroke={nMarkColor} strokeWidth="2" opacity="0.6" />
        <text
          x="245" y="130"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="72"
          fontWeight="800"
          fill="#FFFFFF"
          letterSpacing="-2"
        >
          Factory
        </text>
        <text
          x="540" y="130"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="72"
          fontWeight="800"
          fill={nerveGrad}
          filter={nerveFilter}
          letterSpacing="-2"
        >
          Nerve
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 1000 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <LogoDefs withTextGlow={!isLight} />
      <g transform="matrix(0.7 0 0 0.7 30 28)">
        <FnMarkPaths fColor={fMarkColor} nColor={nMarkColor} dotColor={markDotColor} lineColor={lineColor} />
      </g>
      <line x1="220" y1="40" x2="220" y2="160" stroke={nMarkColor} strokeWidth="2" opacity={0.6} />
      <text
        x="245" y="115"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="62"
        fontWeight="800"
        fill={textColor}
        letterSpacing="-1"
      >
        Factory
      </text>
      <text
        x="503" y="115"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="62"
        fontWeight="800"
        fill={nerveGrad}
        filter={nerveFilter}
        letterSpacing="-1"
      >
        Nerve
      </text>
      <circle cx="248" cy="148" r="2" fill={dotColor} />
      <text
        x="258" y="153"
        fontFamily="JetBrains Mono, monospace, system-ui"
        fontSize="13"
        letterSpacing="3"
        fill={taglineColor}
        fontWeight="600"
      >
        AI-POWERED FACTORY OPERATING SYSTEM
      </text>
    </svg>
  );
}

/**
 * Stacked logo: FN mark above "FactoryNerve" text.
 * viewBox 0 0 400 500.
 */
function StackedLogo({ variant }: { variant: "dark" | "light" }) {
  const isLight = variant === "light";
  const textColor = isLight ? brandNavy : "#FFFFFF";
  const taglineColor = isLight ? "#475569" : brandGray;
  const fMarkColor = isLight ? brandNavy : "url(#fn-whiteGrad)";
  const nMarkColor = `url(#${FN_BLUE_GRADIENT_ID})`;
  const nerveGrad = `url(#${FN_BLUE_TEXT_GRADIENT_ID})`;
  const markDotColor = brandAccent;
  const lineColor = isLight ? brandBlue : brandAccent;

  return (
    <svg viewBox="0 0 400 500" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fn-whiteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#CBD5E0" />
        </linearGradient>
        <linearGradient id={FN_BLUE_GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
        <linearGradient id={FN_BLUE_TEXT_GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <g transform="matrix(0.7 0 0 0.7 130 0)">
        <FnMarkPaths fColor={fMarkColor} nColor={nMarkColor} dotColor={markDotColor} lineColor={lineColor} />
      </g>
      <text
        x="200" y="280"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="48"
        fontWeight="800"
        fill={textColor}
        textAnchor="middle"
        letterSpacing="-1"
      >
        Factory<tspan fill={nerveGrad}>Nerve</tspan>
      </text>
      <line x1="100" y1="310" x2="300" y2="310" stroke={nMarkColor} strokeWidth="1" opacity={0.4} />
      <text
        x="200" y="345"
        fontFamily="JetBrains Mono, monospace, system-ui"
        fontSize="11"
        letterSpacing="3"
        fill={taglineColor}
        fontWeight="600"
        textAnchor="middle"
      >
        AI-POWERED FACTORY OS
      </text>
    </svg>
  );
}

/**
 * Wordmark: "FactoryNerve" text only.
 * viewBox 0 0 600 100.
 */
function Wordmark({ variant }: { variant: "dark" | "light" }) {
  const fill = variant === "light" ? brandNavy : "#FFFFFF";
  return (
    <svg viewBox="0 0 600 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={FN_BLUE_TEXT_GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <text
        x="0" y="70"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="72"
        fontWeight="900"
        fill={fill}
        letterSpacing="-2"
      >
        Factory<tspan fill={`url(#${FN_BLUE_TEXT_GRADIENT_ID})`}>Nerve</tspan>
      </text>
    </svg>
  );
}

export function FnLogo({
  variant = "mark",
  className,
  width,
  height,
}: FnLogoProps) {


  switch (variant) {
    case "mark":
      return (
        <span className={cn("inline-flex items-center justify-center", className)} style={{ width, height }}>
          <FnMark fill="default" />
        </span>
      );
    case "mark-light":
      return (
        <span className={cn("inline-flex items-center justify-center", className)} style={{ width, height }}>
          <FnMark fill="light" />
        </span>
      );
    case "mono-white":
      return (
        <span className={cn("inline-flex items-center justify-center", className)} style={{ width, height }}>
          <FnMark fill="white" />
        </span>
      );
    case "mono-black":
      return (
        <span className={cn("inline-flex items-center justify-center", className)} style={{ width, height }}>
          <FnMark fill="black" />
        </span>
      );
    case "horizontal":
      return (
        <span className={cn("inline-flex items-center justify-center", className)} style={{ width, height }}>
          <HorizontalLogo variant="dark" />
        </span>
      );
    case "horizontal-simple":
      return (
        <span className={cn("inline-flex items-center justify-center", className)} style={{ width, height }}>
          <HorizontalLogo variant="simple" />
        </span>
      );
    case "stacked":
      return (
        <span className={cn("inline-flex items-center justify-center", className)} style={{ width, height }}>
          <StackedLogo variant="dark" />
        </span>
      );
    case "wordmark":
      return (
        <span className={cn("inline-flex items-center justify-center", className)} style={{ width, height }}>
          <Wordmark variant="dark" />
        </span>
      );
    case "wordmark-light":
      return (
        <span className={cn("inline-flex items-center justify-center", className)} style={{ width, height }}>
          <Wordmark variant="light" />
        </span>
      );
  }
}
