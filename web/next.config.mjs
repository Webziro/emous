/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/@:handle',
        destination: '/ask/:handle',
      },
      {
        source: '/u/:handle',
        destination: '/ask/:handle',
      },
      {
        source: '/:handle((?!api|_next|ask|favicon\\.ico|styles\\.css|.*\\..*)[A-Za-z0-9_]{3,30})',
        destination: '/ask/:handle',
      },
    ];
  },
};

export default nextConfig;
