import type { NextConfig } from "next";

// The Flask API runs separately (default :5000). We proxy every /api/* request
// to it so the browser only ever talks to the Next origin — this keeps the
// Flask-Login session cookie same-origin, so auth works with no CORS setup.
// Use 127.0.0.1 (not localhost): on macOS, localhost resolves to ::1 first,
// where the AirPlay Receiver squats on port 5000 — 127.0.0.1 forces IPv4/Flask.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:5000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
