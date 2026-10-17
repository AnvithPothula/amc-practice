import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { aopsApiText, aopsImage } from "./aops-chrome.js";

// Dev only: live AoPS data through a real Chrome window (see aops-chrome.js).
// Production builds read the static snapshot instead (src/lib/aops.js).
const aopsProxy = {
  name: "aops-proxy",
  configureServer(server) {
    server.middlewares.use("/aops-api", async (req, res) => {
      res.setHeader("Content-Type", "application/json");
      try {
        res.end(await aopsApiText(req.url.split("?")[1] ?? ""));
      } catch (e) {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    server.middlewares.use("/aops-images", async (req, res) => {
      try {
        const img = await aopsImage(req.url.slice(1));
        res.statusCode = img.status;
        res.setHeader("Content-Type", img.type ?? "application/octet-stream");
        res.end(Buffer.from(img.body, "base64"));
      } catch (e) {
        res.statusCode = 503;
        res.end(e.message);
      }
    });
  },
};

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the site at anvithpothula.github.io/amc-practice/
  // (`vite preview` mirrors that); the dev server stays at the root.
  base: command === "build" || isPreview ? "/amc-practice/" : "/",
  plugins: [react(), aopsProxy],
  server: {
    open: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        about: resolve(import.meta.dirname, "about/index.html"),
      },
    },
  },
}));
