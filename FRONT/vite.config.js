import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
// import tailwindcss from "@tailwindcss/vite";
import Pages from "vite-plugin-pages";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // tailwindcss(),
    Pages({
      dirs: "src/pages",
    }),
  ],
  ssr: {
    noExternal: ['posthog-js', '@posthog/react']
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      "@styles": path.resolve(__dirname, "./src/styles"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@layout": path.resolve(__dirname, "./src/components/layout"),
      "@contexts": path.resolve(__dirname, "./src/contexts"),
      "@public": path.resolve(__dirname, "./src/public"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@store": path.resolve(__dirname, "./src/store"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@data": path.resolve(__dirname, "./src/data"),
      "@types": path.resolve(__dirname, "./src/types"),
    },
  },
  build: {
    // Nettoie le répertoire de sortie même s'il est externe au projet
    emptyOutDir: true,
    // Définition explicite du dossier de sortie pour permettre le vidage correct
    outDir: "../BACK/assets",
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "plugin.js",
        assetFileNames: (assetInfo) => {
          let extType = assetInfo.name.split(".").at(1);
          if (/png|jpe?g|svg|gif|tiff|mp4|bmp|ico/i.test(extType)) {
            extType = "img";
          }
          return `[name][extname]`;
        },
        chunkFileNames: "chunk.js",
        manualChunks: {
          vendor: ["react", "react-dom"],
          //  "react-router-dom",
        },
      },
    },
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari12"],
  },
});