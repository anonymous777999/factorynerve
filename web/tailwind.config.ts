import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      /* Color Palette - Semantic Colors */
      colors: {
        /* Primary */
        primary: {
          50: "#f0f7ff",
          100: "#dbeaf8",
          200: "#bfd8f0",
          500: "#3b82f6",
          700: "#1d4ed8",
          900: "#1e40af",
        },
        /* Secondary */
        secondary: {
          50: "#f5f3ff",
          100: "#ede9fe",
          500: "#a78bfa",
          700: "#7c3aed",
          900: "#5b21b6",
        },
        /* Success */
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          700: "#15803d",
          900: "#166534",
        },
        /* Warning */
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          700: "#b45309",
          900: "#78350f",
        },
        /* Danger */
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          700: "#b91c1c",
          900: "#7f1d1d",
        },
        /* Info */
        info: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          500: "#06b6d4",
          700: "#0891b2",
          900: "#164e63",
        },
        /* Backgrounds & Surfaces */
        bg: "var(--bg)",
        "bg-secondary": "var(--bg-secondary)",
        "bg-tertiary": "var(--bg-tertiary)",
        card: "var(--card)",
        "card-elevated": "var(--card-elevated)",
        /* Text */
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "text-muted": "var(--text-muted)",
        /* Legacy aliases for backward compatibility */
        base: "var(--bg)",
        text: "var(--text-primary)",
        muted: "var(--text-muted)",
        accent: "var(--color-primary)",
      },
      /* Typography */
      fontSize: {
        xs: ["12px", { lineHeight: "1.5", letterSpacing: "-0.01em" }],
        sm: ["13px", { lineHeight: "1.5", letterSpacing: "-0.01em" }],
        base: ["15px", { lineHeight: "1.5", letterSpacing: "-0.01em" }],
        lg: ["17px", { lineHeight: "1.6", letterSpacing: "-0.01em" }],
        xl: ["19px", { lineHeight: "1.6", letterSpacing: "-0.02em" }],
        "2xl": ["22px", { lineHeight: "1.4", letterSpacing: "-0.02em" }],
        "3xl": ["26px", { lineHeight: "1.3", letterSpacing: "-0.02em" }],
        "4xl": ["30px", { lineHeight: "1.2", letterSpacing: "-0.03em" }],
      },
      fontWeight: {
        light: "300",
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      /* Spacing */
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
        "3xl": "64px",
      },
      /* Border Radius */
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        full: "9999px",
      },
      /* Box Shadow */
      boxShadow: {
        xs: "0 1px 2px rgba(0, 0, 0, 0.3)",
        sm: "0 2px 4px rgba(0, 0, 0, 0.4)",
        md: "0 4px 12px rgba(0, 0, 0, 0.5)",
        base: "0 4px 12px rgba(0, 0, 0, 0.5)",
        lg: "0 10px 24px rgba(0, 0, 0, 0.6)",
        xl: "0 20px 48px rgba(0, 0, 0, 0.7)",
        "2xl": "0 30px 60px rgba(0, 0, 0, 0.8)",
        soft: "0 20px 50px rgba(0, 0, 0, 0.35)",
      },
      /* Transitions */
      transitionDuration: {
        fast: "150ms",
        base: "200ms",
        slow: "300ms",
        slower: "400ms",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;

