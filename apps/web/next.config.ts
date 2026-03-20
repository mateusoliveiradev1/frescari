import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' data: https:",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://vercel.live",
  "img-src 'self' data: blob: https:",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://vercel.live`,
  "style-src 'self' 'unsafe-inline' https:",
  "connect-src 'self' https: https://vercel.live",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: [
    "@frescari/api",
    "@frescari/validators",
    "@frescari/ui",
    "@frescari/db",
  ],
  serverExternalPackages: [
    "better-auth",
    "@neondatabase/serverless",
    "drizzle-orm",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.ufs.sh", port: "", pathname: "/**" },
      { protocol: "https", hostname: "utfs.io", port: "", pathname: "/**" },
      {
        protocol: "https",
        hostname: "**.unsplash.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
