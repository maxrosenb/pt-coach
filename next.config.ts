import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Explicitly set the project root for WSL
  experimental: {
    turbopack: {
      root: path.resolve(__dirname),
    },
  },

  // Enable file watching with polling for WSL
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay before rebuilding
      };
    }
    return config;
  },
};

export default nextConfig;
