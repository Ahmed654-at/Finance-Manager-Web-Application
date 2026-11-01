import { withReticle } from '@reticlehq/next';
import type { NextConfig } from "next";

// Baseline browser protections for every page and API route.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' }, // stops the app being embedded in another site (clickjacking)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }, // ignored on http://localhost
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withReticle(nextConfig, { sourceMapping: false });
