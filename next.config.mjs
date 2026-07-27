/** @type {import('next').NextConfig} */

// Security headers applied to every response. Tuned to score well on
// securityheaders.com / Mozilla Observatory while not breaking the app, which
// uses inline styles throughout (hence 'unsafe-inline' for styles). Scripts are
// limited to same-origin + inline (Next's hydration bootstrap); no external
// script/style/connect origins are allowed.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // small self-contained server build for Docker
  poweredByHeader: false, // don't advertise "X-Powered-By: Next.js"
  // @react-pdf/renderer must run in the Node.js runtime, not bundled for the browser
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer", "bcryptjs", "nodemailer"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
