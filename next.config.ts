/** @type {import('next').NextConfig} */
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

export default config
