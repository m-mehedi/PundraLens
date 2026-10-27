import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["pundrolens.mythacker.shop"],
  experimental: {
    agentUpgrade: "security",
  },
}

export default nextConfig
