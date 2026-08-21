import path from "node:path";
import { fileURLToPath } from "node:url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const dir = path.dirname(fileURLToPath(import.meta.url));

// Makes Cloudflare bindings (DB, ASSETS) available during `next dev`, so local
// development hits a real local D1 rather than the in-memory fallback.
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = { ...(config.resolve.alias || {}), "@": dir };
    return config;
  },
};
