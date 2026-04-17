import type { NextConfig } from "next";

const allowedOrigins: string[] = []
if (process.env.REPLIT_DEV_DOMAIN) {
  allowedOrigins.push(process.env.REPLIT_DEV_DOMAIN)
}

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedOrigins,
};

export default nextConfig;
