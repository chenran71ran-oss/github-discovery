import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  output: "server",
  session: { driver: "memory" },
  adapter: cloudflare({
    imageService: "compile",
    platformProxy: { enabled: true, persist: { path: ".wrangler/state" } },
  }),
  vite: { plugins: [tailwindcss()] },
});
