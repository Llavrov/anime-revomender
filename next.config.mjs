/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "shikimori.one" },
      { protocol: "https", hostname: "shikimori.io" },
    ],
  },
};

export default nextConfig;
