import type { NextConfig } from "next";
export const hotspotApiUrl = '/api/hotspot'
export const queryApiUrl = '/api/query'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/hotspot/:path*',
        destination: 'https://backend.olaphotspot.web.id/api/hotspot/:path*', 
      },
      {
        source: '/api/query/:path*',
        destination: 'https://backend.olaphotspot.web.id/api/query/:path*',
      },
    ];
  },
};

export default nextConfig;