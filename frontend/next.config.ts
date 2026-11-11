import type { NextConfig } from 'next';
// Preserve pre-existing local build output left by other branches.
const config: NextConfig = { distDir: '.next-foundation', poweredByHeader: false };
export default config;
