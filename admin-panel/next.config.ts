import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Force all admin pages to be dynamically rendered at request time.
  // This prevents Next.js from caching stale user/activity data.
  experimental: {},
};

export default nextConfig;
