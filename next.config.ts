import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // There's another package-lock.json higher up in the home folder; pin the project root.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
