import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'logo.clearbit.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'platform.theverge.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.motor1.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.autoexpress.co.uk',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'insideevs.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.twimg.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
