import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isTauri = process.env.NEXT_TAURI === "1";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  ...(isTauri && {
    output: "export",
    distDir: "out",
  }),
};

export default isTauri ? nextConfig : withNextIntl(nextConfig);
