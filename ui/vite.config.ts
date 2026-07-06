import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The embed UI is iframed by ss-platform-app from the app's app_url. A relative base keeps
// asset paths portable so the api can serve the built bundle from any mount path (p2-admin-ui).
export default defineConfig({
  plugins: [react()],
  base: "",
  build: { outDir: "dist" },
});
