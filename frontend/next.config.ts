import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

const nextConfig: NextConfig = {
  output: "standalone",
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
