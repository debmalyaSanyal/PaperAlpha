import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "prisma", "ioredis"],
  // Serverless functions start with an empty /tmp and a read-only bundle. The
  // SQLite tables are created at runtime from the embedded DDL (lib/db.ts), so
  // the Prisma engine + generated client must be traced into the function
  // bundle for every route that touches the database - otherwise queries fail
  // with "Query engine library for current platform could not be found".
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
      "./node_modules/@prisma/engines/**/*",
      "./prisma/schema.prisma",
    ],
  },
  experimental: {
    // Uploaded research material (notebooks, PDFs, datasets) is posted to
    // route handlers via multipart/form-data.
    serverActions: {
      bodySizeLimit: "64mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
