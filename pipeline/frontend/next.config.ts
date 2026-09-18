import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-mode route indicator badge renders fixed to the bottom-left
  // corner, right on top of the chat panel's input row in this layout —
  // it eats clicks meant for the chips/Confirm button. Dev-only chrome,
  // not present in a production build, so turning it off costs nothing.
  devIndicators: false,
};

export default nextConfig;
