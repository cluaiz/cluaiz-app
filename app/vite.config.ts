import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const configured = command === "serve" ? loadEnv(mode, process.cwd(), "CLUAIZ_").CLUAIZ_MODEL_REGISTRY_ORIGIN : undefined;
  let registryOrigin = "https://cluaiz.com";
  if (configured) {
    const target = new URL(configured);
    if (!["http:", "https:"].includes(target.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
      || target.username || target.password || target.pathname !== "/" || target.search || target.hash) throw new Error("Development model registry must be a loopback origin");
    registryOrigin = target.origin;
  }
  return {
  define: { __CLUAIZ_MODEL_REGISTRY_ORIGIN__: JSON.stringify(registryOrigin) },
  plugins: [react(), tailwindcss()] as any,
  publicDir: "../public",

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0", // Expose to all network interfaces so Emulator can connect
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  };
});
