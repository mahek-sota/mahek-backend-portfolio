import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Pin the workspace root so a lockfile elsewhere on the machine isn't picked up.
  turbopack: { root: import.meta.dirname },
  async redirects() {
    // A short, stable link to the resume for applications and email signatures.
    return [{ source: "/resume", destination: "/mahek-sota-resume.pdf", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
