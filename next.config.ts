import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development", // Se desactiva en modo desarrollo local para evitar problemas de caché
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig = {
  reactStrictMode: true,
  turbopack: {}, // Soluciona el conflicto de Next.js 16 con plugins basados en Webpack
};

export default withPWA(nextConfig);