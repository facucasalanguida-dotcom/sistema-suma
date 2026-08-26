import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * `@react-pdf/renderer` arrastra dependencias nativas de Node (fuentes,
   * streams) que no deben pasar por el bundler del servidor.
   */
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
