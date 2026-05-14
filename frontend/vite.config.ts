import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const port = Number(env.VITE_PORT ?? 4329);
  const backendUrl = env.VITE_BACKEND_URL ?? "http://127.0.0.1:8729";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      // Proxy /api/* to the backend during dev so we avoid CORS and the
      // frontend can use relative URLs in API calls.
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
    preview: { port },
  };
});
