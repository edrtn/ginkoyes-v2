import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.1.67", "127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.sport2000.fr",
        pathname: "/photos_plateforme_digitale/**",
      },
    ],
  },
};

export default nextConfig;
