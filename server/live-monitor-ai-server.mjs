import { createServer } from "node:http";
import { analyzeLiveMonitorSession, loadLocalEnv } from "./live-monitor-ai-core.mjs";

loadLocalEnv();

const PORT = Number(process.env.PORT || process.env.LIVE_MONITOR_AI_PORT || 8787);

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function handleAnalyze(request, response) {
  try {
    const body = await readBody(request);
    const result = await analyzeLiveMonitorSession(body);

    json(response, 200, {
      generatedAt: result.generatedAt,
      observations: result.observations,
      report: result.report
    });
  } catch (error) {
    json(response, 500, {
      error: error.message || "Live monitor analysis failed."
    });
  }
}

const server = createServer((request, response) => {
  if (request.method === "OPTIONS") {
    json(response, 204, {});
    return;
  }

  if (request.method === "POST" && request.url === "/api/live-monitor/analyze") {
    void handleAnalyze(request, response);
    return;
  }

  if (request.method === "GET" && request.url === "/api/live-monitor/health") {
    json(response, 200, { ok: true });
    return;
  }

  json(response, 404, { error: "Not found." });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Live monitor AI server listening on port ${PORT}`);
});
