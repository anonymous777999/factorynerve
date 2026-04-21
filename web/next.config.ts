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
const normalizedExplicitBackendOrigin = explicitBackendOrigin.trim().replace(/\/+$/, "");
const isProductionBuild =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL === "1" ||
  Boolean(process.env.VERCEL_ENV);

if (isProductionBuild && !normalizedExplicitBackendOrigin) {
  throw new Error(
    "Missing API proxy origin for production build. Set API_PROXY_ORIGIN or NEXT_PUBLIC_API_PROXY_ORIGIN to the public backend URL before deploying web.",
  );
}

const backendOrigin = normalizedExplicitBackendOrigin
  ? normalizedExplicitBackendOrigin
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
};

export default nextConfig;
