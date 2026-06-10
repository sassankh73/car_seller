/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin();

const nextConfig = {
  output: "standalone",

  images: {
    // Disable Next.js image optimization entirely.
    // All images are served via the /static/* rewrite proxy —
    // optimization would require whitelisting every possible backend hostname
    // (localhost, backend, SERVER_IP) and breaks when accessed from other machines.
    unoptimized: true,
  },

  async rewrites() {
    // Read env vars HERE (inside the function) so they are evaluated at server
    // startup time, not baked into routes-manifest.json at build time.
    // With .env.local BACKEND_HOST removed:
    //   npm run dev  → NODE_ENV=development → fallback 'localhost' → correct for local
    //   npm run build (Docker) → NODE_ENV=production → fallback 'backend' → correct for Docker
    const host =
      process.env.BACKEND_HOST ||
      (process.env.NODE_ENV === "development" ? "localhost" : "backend");
    const port = process.env.BACKEND_PORT || "8001";
    return [
      {
        source: "/api/:path*",
        destination: `http://${host}:${port}/api/:path*`,
      },
      {
        source: "/static/:path*",
        destination: `http://${host}:${port}/static/:path*`,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
