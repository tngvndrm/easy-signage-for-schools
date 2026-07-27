/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloud Run: ship a minimal server bundle instead of the whole node_modules tree.
  output: "standalone",
  // The dev badge sits exactly where the message zone is — hide it so what you
  // see locally is what the kiosk shows.
  devIndicators: false,
};

export default nextConfig;
