/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["*.e2b.app"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
