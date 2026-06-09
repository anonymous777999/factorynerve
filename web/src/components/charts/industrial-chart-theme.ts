"use client";

import type { ApexOptions } from "apexcharts";

type ChartSeriesPalette = {
  primary: string;
  success: string;
  danger: string;
  warning: string;
  processing: string;
};

type ApexThemeConfig = {
  chartBackground: string;
  gridColor: string;
  axisLineColor: string;
  axisLabelColor: string;
  legendTextColor: string;
  tooltipBackground: string;
  tooltipTextColor: string;
  tooltipBorderColor: string;
  titleColor: string;
  dataLabelColor: string;
  donutStrokeColor: string;
  markerFillColor: string;
  tooltipMode: NonNullable<ApexOptions["tooltip"]>["theme"];
};

export type ChartThemeConfig = {
  surfaceCard: string;
  surfaceElevated: string;
  borderSubtle: string;
  textTertiary: string;
  textSecondary: string;
  textPrimary: string;
  series: ChartSeriesPalette;
  apex: ApexThemeConfig;
};

const FALLBACK_THEME: ChartThemeConfig = {
  surfaceCard: "var(--surface-card)",
  surfaceElevated: "var(--surface-elevated)",
  borderSubtle: "var(--border-subtle)",
  textTertiary: "var(--text-tertiary)",
  textSecondary: "var(--text-secondary)",
  textPrimary: "var(--text-primary)",
  series: {
    primary: "var(--action-primary)",
    success: "var(--status-success-icon)",
    danger: "var(--status-danger-icon)",
    warning: "var(--status-warning-icon)",
    processing: "var(--status-processing-icon)",
  },
  apex: {
    chartBackground: "var(--surface-card)",
    gridColor: "var(--border-subtle)",
    axisLineColor: "var(--border-subtle)",
    axisLabelColor: "var(--text-tertiary)",
    legendTextColor: "var(--text-tertiary)",
    tooltipBackground: "var(--surface-elevated)",
    tooltipTextColor: "var(--text-secondary)",
    tooltipBorderColor: "var(--border-subtle)",
    titleColor: "var(--text-primary)",
    dataLabelColor: "var(--text-primary)",
    donutStrokeColor: "var(--surface-card)",
    markerFillColor: "var(--surface-card)",
    tooltipMode: "dark",
  },
};

function readCssVariable(styles: CSSStyleDeclaration, name: string, fallback: string) {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

function clampChannel(value: number) {
  return Math.min(255, Math.max(0, value));
}

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const h = ((hue % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((h % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (h >= 0 && h < 1) {
    red = c;
    green = x;
  } else if (h < 2) {
    red = x;
    green = c;
  } else if (h < 3) {
    green = c;
    blue = x;
  } else if (h < 4) {
    green = x;
    blue = c;
  } else if (h < 5) {
    red = x;
    blue = c;
  } else {
    red = c;
    blue = x;
  }

  const matchLightness = l - c / 2;
  return {
    r: clampChannel(Math.round((red + matchLightness) * 255)),
    g: clampChannel(Math.round((green + matchLightness) * 255)),
    b: clampChannel(Math.round((blue + matchLightness) * 255)),
  };
}

function parseColor(value: string) {
  const color = value.trim();
  const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    const normalized =
      hex.length === 3 ? hex.split("").map((channel) => channel + channel).join("") : hex;
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }

  const rgbMatch = color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgbMatch) {
    return {
      r: clampChannel(Number(rgbMatch[1])),
      g: clampChannel(Number(rgbMatch[2])),
      b: clampChannel(Number(rgbMatch[3])),
    };
  }

  const hslMatch = color.match(/^hsla?\(\s*([\d.]+)(deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
  if (hslMatch) {
    return hslToRgb(Number(hslMatch[1]), Number(hslMatch[3]), Number(hslMatch[4]));
  }

  return null;
}

function channelToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(foreground: string, background: string) {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) {
    return 0;
  }

  const foregroundLuminance =
    0.2126 * channelToLinear(fg.r) +
    0.7152 * channelToLinear(fg.g) +
    0.0722 * channelToLinear(fg.b);
  const backgroundLuminance =
    0.2126 * channelToLinear(bg.r) +
    0.7152 * channelToLinear(bg.g) +
    0.0722 * channelToLinear(bg.b);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function withMinimumContrast(preferred: string, background: string, fallbacks: string[]) {
  if (contrastRatio(preferred, background) >= 3) {
    return preferred;
  }

  let strongest = preferred;
  let strongestRatio = contrastRatio(preferred, background);

  for (const candidate of fallbacks) {
    const ratio = contrastRatio(candidate, background);
    if (ratio >= 3) {
      return candidate;
    }
    if (ratio > strongestRatio) {
      strongest = candidate;
      strongestRatio = ratio;
    }
  }

  return strongest;
}

export function getChartTheme(element?: HTMLElement): ChartThemeConfig {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return FALLBACK_THEME;
  }

  const styles = getComputedStyle(element ?? document.documentElement);
  const surfaceCard = readCssVariable(styles, "--surface-card", FALLBACK_THEME.surfaceCard);
  const surfaceElevated = readCssVariable(styles, "--surface-elevated", FALLBACK_THEME.surfaceElevated);
  const borderSubtle = readCssVariable(styles, "--border-subtle", FALLBACK_THEME.borderSubtle);
  const textTertiary = readCssVariable(styles, "--text-tertiary", FALLBACK_THEME.textTertiary);
  const textSecondary = readCssVariable(styles, "--text-secondary", FALLBACK_THEME.textSecondary);
  const textPrimary = readCssVariable(styles, "--text-primary", FALLBACK_THEME.textPrimary);
  const success = readCssVariable(styles, "--status-success-icon", FALLBACK_THEME.series.success);
  const danger = readCssVariable(styles, "--status-danger-icon", FALLBACK_THEME.series.danger);
  const warning = readCssVariable(styles, "--status-warning-icon", FALLBACK_THEME.series.warning);
  const primaryCandidate = readCssVariable(styles, "--action-primary", FALLBACK_THEME.series.primary);
  const processing = readCssVariable(styles, "--status-processing-icon", FALLBACK_THEME.series.processing);
  const primary = withMinimumContrast(primaryCandidate, surfaceCard, [processing, success, warning, danger]);
  const tooltipMode = contrastRatio(textSecondary, surfaceElevated) >= 4.5 ? "dark" : "light";

  return {
    surfaceCard,
    surfaceElevated,
    borderSubtle,
    textTertiary,
    textSecondary,
    textPrimary,
    series: {
      primary,
      success,
      danger,
      warning,
      processing,
    },
    apex: {
      chartBackground: surfaceCard,
      gridColor: borderSubtle,
      axisLineColor: borderSubtle,
      axisLabelColor: textTertiary,
      legendTextColor: textTertiary,
      tooltipBackground: surfaceElevated,
      tooltipTextColor: textSecondary,
      tooltipBorderColor: borderSubtle,
      titleColor: textPrimary,
      dataLabelColor: textPrimary,
      donutStrokeColor: surfaceCard,
      markerFillColor: surfaceCard,
      tooltipMode,
    },
  };
}
