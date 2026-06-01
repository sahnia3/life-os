import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["chokidar", "better-sqlite3", "fsevents", "node-pty", "ws"],
};

export default nextConfig;
