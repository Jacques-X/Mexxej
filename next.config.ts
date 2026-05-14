import type { NextConfig } from "next";

// Fail at build/startup rather than silently at runtime when a required
// server-side env var is missing.
const REQUIRED_ENV_VARS = [
  "GEMINI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
];

for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

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
