import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

type EnvMap = Record<string, string>;

const loadBackendEnv = (): EnvMap => {
  try {
    const envPath = path.resolve(__dirname, "..", ".env");
    const raw = fs.readFileSync(envPath, "utf8");
    const parsed: EnvMap = {};
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) return;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (key && !(key in parsed)) parsed[key] = value;
    });
    return parsed;
  } catch {
    return {};
  }
};

const backendEnv = loadBackendEnv();
const explicitBackendOrigin =
  process.env.API_PROXY_ORIGIN ||
  process.env.NEXT_PUBLIC_API_PROXY_ORIGIN ||
  backendEnv.API_PROXY_ORIGIN ||
  backendEnv.NEXT_PUBLIC_API_PROXY_ORIGIN ||
  "";
const backendHost =
  process.env.NEXT_PUBLIC_API_HOST || backendEnv.FASTAPI_HOST || "127.0.0.1";
const backendPort =
  process.env.NEXT_PUBLIC_API_PORT || backendEnv.FASTAPI_PORT || "8765";
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production";
const backendOrigin = explicitBackendOrigin.trim().replace(/\/+$/, "");

if (!backendOrigin && isVercel) {
  throw new Error(
    "API_PROXY_ORIGIN or NEXT_PUBLIC_API_PROXY_ORIGIN must be set in Vercel so /api/* can proxy to the Render backend.",
  );
}

const resolvedBackendOrigin = backendOrigin || `http://${backendHost}:${backendPort}`;

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.213.1"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${resolvedBackendOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
