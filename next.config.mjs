/** @type {import('next').NextConfig} */
const nextConfig = {
  // Electron and Capacitor both package the static files emitted to out/.
  output: 'export',
  trailingSlash: true,
  allowedDevOrigins: ['192.168.0.28'],
};

export default nextConfig;
