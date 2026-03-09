import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@frescari/api", "@frescari/validators", "@frescari/ui", "@frescari/db"],
  serverExternalPackages: ["better-auth", "@neondatabase/serverless", "drizzle-orm"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
      },
    ],
  },
};

export default nextConfig;

