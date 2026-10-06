import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@nimbus/core"],
  reactStrictMode: true,
};

export default nextConfig;
