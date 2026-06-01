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
const backendOrigin = explicitBackendOrigin.trim()
  ? explicitBackendOrigin.trim().replace(/\/+$/, "")
  : `http://${backendHost}:${backendPort}`;

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.213.1"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        // HTML pages must never be cached — they reference hashed JS chunks.
        // If a browser caches stale HTML after a redeployment, it will try to
        // load old chunk hashes that no longer exist on the server.
        source: "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        // Static assets (JS/CSS chunks) are content-addressed by hash — safe to
        // cache forever. Next.js already sets this but we make it explicit.
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
