import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Export estático: genera HTML plano en `out/` para servir directo
  // desde Cloudflare Pages sin runtime de Node.
  output: "export",
};

export default nextConfig;
