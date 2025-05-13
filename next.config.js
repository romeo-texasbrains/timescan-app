/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  sw: 'service-worker.js', // Changed to match the service worker filename
});

const config = {
  // ⬇️ Allow production builds even if ESLint errors exist
  eslint: {
    ignoreDuringBuilds: true,
  },
  // ⬇️ Allow production builds even if TypeScript errors exist
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      enabled: true
    },
    // nodeMiddleware: true, // Keep disabled - requires canary version
  }
}

module.exports = withPWA(config);
