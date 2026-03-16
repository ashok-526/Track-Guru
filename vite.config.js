import { analyzeLiveMonitorSession, loadLocalEnv } from "./server/live-monitor-ai-core.mjs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

loadLocalEnv();

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function liveMonitorApiPlugin() {
  async function handle(request, response, next) {
    if (request.url === "/api/live-monitor/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method !== "POST" || request.url !== "/api/live-monitor/analyze") {
      next();
      return;
    }

    try {
      const body = await readJsonBody(request);
      const result = await analyzeLiveMonitorSession(body);

      sendJson(response, 200, {
        generatedAt: result.generatedAt,
        observations: result.observations,
        report: result.report
      });
    } catch (error) {
      sendJson(response, 500, {
        error: error.message || "Live monitor image analysis failed."
      });
    }
  }

  return {
    name: "live-monitor-api",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        void handle(request, response, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        void handle(request, response, next);
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), liveMonitorApiPlugin()],
  server: {
    host: true,
    port: 5173
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("react-pdf") || id.includes("pdfjs-dist")) {
            return "pdf";
          }

          if (id.includes("face-api.js")) {
            return "face-recognition";
          }

          if (id.includes("firebase")) {
            return "firebase";
          }

          if (id.includes("framer-motion")) {
            return "framer-motion";
          }

          if (id.includes("node_modules")) {
            return "vendor";
          }
        }
      }
    }
  }
});
