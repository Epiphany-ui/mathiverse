import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 blocks dev-resource requests (JS chunks, HMR) from any origin it
  // doesn't recognize.  The browser reaches the dev server via these hosts
  // (localhost, WSL loopback, LAN IP), so all three must be allowed or every
  // page fails to hydrate with 403s on its chunks.
  allowedDevOrigins: ["localhost", "127.0.0.1", "10.255.255.254"],
};

export default nextConfig;
