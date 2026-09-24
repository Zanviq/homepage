import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    // 3D models / textures for /drive: large and rarely changed, so let
    // browsers (and Cloudflare) keep them for a week.
    return [
      {
        source: "/drive-assets/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
  async rewrites() {
    // Proxy every /api/* call (from the browser) to the backend service so
    // cookies stay first-party on zanviq.dev and the tunnel only needs the
    // frontend as its origin.
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
