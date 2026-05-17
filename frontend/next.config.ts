import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip ESLint during `next build`. Linting still runs locally (`npm run
  // lint`) and in the editor — the production build just shouldn't fail on
  // style/strict-TS rules that don't affect runtime behavior.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
