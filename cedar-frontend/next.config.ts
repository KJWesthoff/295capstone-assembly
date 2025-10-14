import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Disable ESLint during builds for Docker
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript errors during builds for Docker
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
