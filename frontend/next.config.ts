import type { NextConfig } from 'next';

// Server-side env var — safe to use in rewrites (evaluated at build + server start)
// Local dev:  http://localhost:5001  (default)
// Docker:     http://backend:5001    (passed as build ARG in docker-compose)
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
