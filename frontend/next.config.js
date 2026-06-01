/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin();

const backendHost = process.env.BACKEND_HOST || (process.env.NODE_ENV === "development" ? "localhost" : "backend");
const backendPort = process.env.BACKEND_PORT || "8001";

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
        destination: `http://${backendHost}:${backendPort}/api/:path*`,
      },
      {
        source: "/static/:path*",
        destination: `http://${backendHost}:${backendPort}/static/:path*`,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
