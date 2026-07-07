import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The embed UI is iframed by ss-platform-app from the app's public URL. A relative base keeps
// asset paths portable so the api can serve the built bundle from any mount path.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "",
  build: { outDir: "dist" },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
