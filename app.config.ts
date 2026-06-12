import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

const isCapacitor = process.env.CAPACITOR === "true";

export default defineConfig({
  ssr: isCapacitor ? false : undefined,
  server: isCapacitor ? { preset: "static" } : undefined,
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      conditions: ["import", "module", "browser", "default"],
    },
    build: {
      rollupOptions: {
        external: isCapacitor ? [] : ["@capacitor/app"],
      },
    },
  },
});
