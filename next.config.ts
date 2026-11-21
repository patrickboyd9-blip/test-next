import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "o1at7qxja3v9ya7m.public.blob.vercel-storage.com",
        pathname: "/gallery/**",
      },
    ],
  },
  // Keep the SDK out of the webpack graph. Bundling it during compile of `/`
  // (via server actions) hangs the first request with idle CPU.
  // pdf-lib's font kit is server-only and does not bundle cleanly.
  serverExternalPackages: ["@anthropic-ai/sdk", "pdf-lib", "@pdf-lib/fontkit"],
  async redirects() {
    return [
      { source: "/app/gallery", destination: "/app/templates", permanent: false },
      { source: "/app/advanced", destination: "/app", permanent: false },
      { source: "/app/advanced/:path*", destination: "/app", permanent: false },
    ]
  },
  outputFileTracingIncludes: {
    "/app/campaigns/[id]": [
      "./lib/print-spec/fonts/**/*",
      "./lib/design-intelligence/seed/**/*",
      "./lib/design-intelligence/ad-psych/**/*.md",
    ],
    "/app/campaigns/[id]/guidance": ["./lib/design-intelligence/ad-psych/**/*.md"],
    "/api/cron/design-library": ["./lib/design-intelligence/seed/**/*"],
    "/api/design-library/sync": ["./lib/design-intelligence/seed/**/*"],
    "/api/design-benchmark": ["./lib/design-intelligence/seed/**/*"],
  },
};

export default nextConfig;
