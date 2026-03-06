import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@frescari/api", "@frescari/validators", "@frescari/ui", "@frescari/db"],
  serverExternalPackages: ["better-auth", "@neondatabase/serverless", "drizzle-orm"],
};

export default nextConfig;
