import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@frescari/api", "@frescari/validators", "@frescari/ui", "@frescari/db"],
  serverExternalPackages: ["better-auth", "@neondatabase/serverless", "drizzle-orm"],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'utfs.io' },
      { protocol: 'https', hostname: '**.unsplash.com', port: '', pathname: '/**' }
    ],
  },
};

export default nextConfig;
