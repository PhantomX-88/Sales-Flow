/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  experimental: {
    // `lucide-react` and `recharts` ship large barrel files. Rewriting the named
    // imports to direct module paths keeps the dev server from having to read
    // hundreds of icon/chart modules before the first paint.
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
