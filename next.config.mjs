/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // StrictMode's dev-only double-mount loses the WebGL context under the
  // postprocessing composer (prod is unaffected either way).
  reactStrictMode: false,
  turbopack: { root: import.meta.dirname },
  // GitHub Pages serves from /<repo>/ — CI sets BASE_PATH accordingly.
  basePath: process.env.BASE_PATH ?? "",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
