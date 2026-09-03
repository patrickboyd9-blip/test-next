import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the SDK out of the webpack graph. Bundling it during compile of `/`
  // (via server actions) hangs the first request with idle CPU.
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
