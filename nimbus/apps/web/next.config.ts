import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The app has no server-side features: local mode runs entirely in the
  // browser and aws mode talks to API Gateway. A static export can be hosted
  // on S3 + CloudFront from the CDK app.
  output: 'export',
  images: { unoptimized: true },
  transpilePackages: ['@nimbus/core'],
  reactStrictMode: true,
};

export default nextConfig;
