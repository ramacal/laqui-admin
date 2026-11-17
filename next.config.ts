import type { NextConfig } from "next";

// Allow next/image to load public files (agency logos) from the storage bucket.
const storage = new URL(process.env.STORAGE_PUBLIC_URL ?? "http://localhost:8333/laqui-public");

const nextConfig: NextConfig = {
  // pdf.js reads the Quiniela program PDF on the server; load it from node_modules as is.
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    // Photos of Lotería tickets and receipts are uploaded through server actions.
    serverActions: { bodySizeLimit: "8mb" },
  },
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
