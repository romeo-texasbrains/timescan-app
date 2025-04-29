/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    serverActions: {
      enabled: true
    },
    // nodeMiddleware: true, // Disabled for stability
  }
}

export default config
