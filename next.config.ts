import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  // There's another package-lock.json higher up in the home folder; pin the project root.
  outputFileTracingRoot: path.join(__dirname),
  webpack: (config) => {
    // The local database (.pgdata), HTTP cache and exports change constantly at runtime;
    // watching them made the dev server recompile in a loop.
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/.pgdata/**", "**/.cache/**", "**/exports/**"],
    };
    return config;
  },
};

export default nextConfig;
