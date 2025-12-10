import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Required for Docker production builds
  eslint: {
    // Disable ESLint during builds for Docker
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript errors during builds for Docker
    ignoreBuildErrors: true,
  },
  // Note: Removed custom webpack image rule that conflicted with Next.js's
  // built-in image handling and caused broken images in production
  async rewrites() {
    const scannerUrl = process.env.SCANNER_SERVICE_URL || 'http://localhost:8000';
    console.log(`[Next.js] Rewriting /api/* to ${scannerUrl}/api/* (except /api/scan/*/findings)`);
    return [
      // Let Next.js API routes handle findings (for CWE/OWASP enrichment)
      // This route is NOT proxied - it goes to /app/api/scan/[scanId]/findings/route.ts
      {
        source: '/api/scan/:scanId/findings',
        destination: '/api/scan/:scanId/findings',
      },
      // Proxy everything else to scanner backend
      {
        source: '/api/:path*',
        destination: `${scannerUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
