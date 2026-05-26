/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin();

const backendApiUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8002",
        pathname: "/**",
      },
    ],
    // Allow blob URLs for preview
    unoptimized: process.env.NODE_ENV === "development",
  },
  // API proxy for development
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendApiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
