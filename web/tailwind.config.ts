import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: "var(--bg)",
        card: "var(--card)",
        text: "var(--text)",
        muted: "var(--muted)",
        accent: "var(--accent)",
      },
      boxShadow: {
        soft: "0 20px 50px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;

