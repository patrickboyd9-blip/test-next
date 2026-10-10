import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the SDK out of the webpack graph. Bundling it during compile of `/`
  // (via server actions) hangs the first request with idle CPU.
  // pdf-lib's font kit is server-only and does not bundle cleanly.
  serverExternalPackages: ["@anthropic-ai/sdk", "pdf-lib", "@pdf-lib/fontkit"],
  outputFileTracingIncludes: {
    "/app/campaigns/[id]": ["./lib/print-spec/fonts/**/*"],
  },
};

export default nextConfig;
