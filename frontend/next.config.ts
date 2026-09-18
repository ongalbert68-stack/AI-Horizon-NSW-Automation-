import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only route indicator badge, fixed to the bottom-left corner — no
  // effect on a production build. Off so it can't sit on top of controls.
  devIndicators: false,
};

export default nextConfig;
