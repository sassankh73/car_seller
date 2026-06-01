/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin();

const backendApiUrl =
  process.env.NEXT_PUBLIC_API_URL || "https://autostudio.cc";

const nextConfig = {
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8001",
        pathname: "/**",
      },
    ],

    unoptimized: process.env.NODE_ENV === "development",
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://backend:8001/api/:path*",
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
