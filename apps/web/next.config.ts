import type { NextConfig } from "next";

// Rewrites are resolved at build time, so API_URL must be set when building the image.
const API_URL = process.env.API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return {
      // "/" is the static landing page in public/home (no React, copied from the old Atlas).
      beforeFiles: [{ source: "/", destination: "/home/index.html" }],
      afterFiles: [{ source: "/api/:path*", destination: `${API_URL}/:path*` }],
      fallback: [],
    };
  },
};

export default nextConfig;
