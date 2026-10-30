/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // O lint roda no CI (passo dedicado) — manter o build livre de lint
  // evita que um aviso de lint derrube o deploy da Vercel.
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb", // limite para upload de documentos
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
