/** @type {import('next').NextConfig} */
const nextConfig = {
  // Electron and Capacitor both package the static files emitted to out/.
  output: process.env.NEXT_PRIVATE_STANDALONE === 'true' ? 'standalone' : 'export',
  trailingSlash: true,
  allowedDevOrigins: ['192.168.0.28'],
};

export default nextConfig;
