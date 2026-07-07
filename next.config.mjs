/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // small self-contained server build for Docker
  // @react-pdf/renderer must run in the Node.js runtime, not bundled for the browser
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer", "bcryptjs", "nodemailer"],
  },
};

export default nextConfig;
