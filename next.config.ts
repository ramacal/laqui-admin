import type { NextConfig } from "next";

// Allow next/image to load public files (agency logos) from the storage bucket.
const storage = new URL(process.env.STORAGE_PUBLIC_URL ?? "http://localhost:8333/laqui-public");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: storage.protocol.replace(":", "") as "http" | "https",
        hostname: storage.hostname,
        port: storage.port,
        pathname: `${storage.pathname.replace(/\/$/, "")}/**`,
      },
    ],
    // Local storage runs on localhost; Next blocks optimizing private IPs by default.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
};

export default nextConfig;
