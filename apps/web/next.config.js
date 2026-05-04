const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  // Disable PWA in development to avoid noise in the console
  disable: process.env.NODE_ENV === 'development',
  // Cache pages and static assets aggressively
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Precache the app shell
  workboxOptions: {
    disableDevLogs: true,
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // Proxy /api/* → API interna (browser nunca fala direto com a API)
  async rewrites() {
    const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },
      { protocol: 'https', hostname: '*.s3.*.amazonaws.com' },
    ],
  },
}

module.exports = withPWA(nextConfig)
