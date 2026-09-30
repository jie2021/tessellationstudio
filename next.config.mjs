/** @type {import('next').NextConfig} */
const nextConfig = {
  // Electron and Capacitor both package the static files emitted to out/.
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
