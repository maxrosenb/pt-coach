import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Use Turbopack with default settings
  turbopack: {},

  // Enable file watching with polling for WSL
  // This is critical for WSL file watching on Windows filesystem
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay before rebuilding
        ignored: /node_modules/, // Don't watch node_modules
      };
    }
    return config;
  },
};

export default nextConfig;
