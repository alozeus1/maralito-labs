/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phase 0: no rewrites/integrations. i18n + middleware wired in Phase 1/2.
  experimental: { typedRoutes: true },
};
export default nextConfig;
