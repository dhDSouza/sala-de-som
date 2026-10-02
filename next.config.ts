import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	serverExternalPackages: ['typeorm', 'pg'],
	allowedDevOrigins: ['192.168.*.*'],
	images: {
		remotePatterns: [{ protocol: 'https', hostname: 'i.ytimg.com', pathname: '/vi/**' }],
	},
}

export default nextConfig
