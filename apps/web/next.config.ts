import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Note: "standalone" output is used for Docker deployments.
  // Vercel ignores this setting and uses its own optimized output.
  // Keeping it so the Dockerfile still works for self-hosted setups.
  output: "standalone",
};

export default nextConfig;
