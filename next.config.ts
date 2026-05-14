import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "maps.googleapis.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/v1/3dtiles/:path*",
        destination: "/api/tiles/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
