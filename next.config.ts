import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    optimizePackageImports: ["lucide-react"]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.barbora.lv",
        pathname: "/products/**"
      },
      {
        protocol: "https",
        hostname: "images.openfoodfacts.org",
        pathname: "/images/products/**"
      },
      {
        protocol: "https",
        hostname: "rimibaltic-res.cloudinary.com",
        pathname: "/image/upload/**"
      },
      {
        protocol: "https",
        hostname: "images.livinn.lt",
        pathname: "/**"
      }
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
        ]
      }
    ];
  }
};

export default nextConfig;
