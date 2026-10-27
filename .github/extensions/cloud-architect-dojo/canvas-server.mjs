import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  answerQuestion,
  applyEvent,
  getDojoState,
  resetDojo,
  selectScenario,
  toggleComponent,
} from "./dojo-service.mjs";

const extensionDirectory = dirname(fileURLToPath(import.meta.url));
const assetDirectory = join(extensionDirectory, "assets");
const htmlTemplate = await readFile(join(assetDirectory, "index.html"), "utf8");

export async function startCanvasServer({ instanceId }) {
  const clients = new Set();
  const server = createServer(async (request, response) => {
    setSecurityHeaders(response);
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/") {
        return send(response, 200, "text/html; charset=utf-8", htmlTemplate);
      }
      if (request.method === "GET" && ["/styles.css", "/app.js"].includes(url.pathname)) {
        return serveAsset(response, url.pathname.slice(1));
      }
      if (request.method === "GET" && url.pathname === "/api/bootstrap") {
        return sendJson(response, 200, await getDojoState());
      }
      if (request.method === "GET" && url.pathname === "/events") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        response.write(`event: ready\ndata: ${JSON.stringify({ instanceId })}\n\n`);
        clients.add(response);
        request.on("close", () => clients.delete(response));
        return;
      }
      if (request.method === "POST" && url.pathname.startsWith("/api/")) {
        const body = await readJsonBody(request);
        const { state, message } = await handleMutation(url.pathname, body);
        broadcast(clients, "state", state);
        return sendJson(response, 200, { ...state, message });
      }
      return sendJson(response, 404, { error: "not_found", message: "Route not found." });
    } catch (error) {
      const status = error?.statusCode ?? 500;
      return sendJson(response, status, {
        error: error?.code ?? "internal_error",
        message: error instanceof Error ? error.message : "Request failed.",
      });
    }
  });

  server.on("clientError", (_error, socket) => {
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string" || address.address !== "127.0.0.1") {
    await closeServer(server);
    throw new Error("Canvas server did not bind to a loopback IPv4 port.");
  }

  return {
    server,
    url: `http://127.0.0.1:${address.port}/`,
    close: async () => {
      for (const client of clients) client.end();
      clients.clear();
      await closeServer(server);
    },
  };
}

async function handleMutation(pathname, body) {
  if (pathname === "/api/scenario/select") {
    const scenarioId = requireString(body.scenarioId, "scenarioId");
    return {
      state: await selectScenario(scenarioId),
      message: "Mission loaded. Build the first version of your architecture.",
    };
  }
  if (pathname === "/api/architecture/toggle") {
    const state = await toggleComponent({
      scenarioId: requireString(body.scenarioId, "scenarioId"),
      componentId: requireString(body.componentId, "componentId"),
    });
    return { state, message: "Architecture updated. Incident results were cleared." };
  }
  if (pathname === "/api/event/apply") {
    const state = await applyEvent({
      scenarioId: requireString(body.scenarioId, "scenarioId"),
      eventId: requireString(body.eventId, "eventId"),
    });
    return { state, message: "Incident applied. Review the metric deltas and resilience feedback." };
  }
  if (pathname === "/api/quiz/answer") {
    const result = await answerQuestion({
      scenarioId: requireString(body.scenarioId, "scenarioId"),
      questionId: requireString(body.questionId, "questionId"),
      answerIndex: requireInteger(body.answerIndex, "answerIndex"),
    });
    return {
      state: result.state,
      message: `${result.correct ? "Correct." : "Not quite."} ${result.explanation}`,
    };
  }
  if (pathname === "/api/reset") {
    const scope = requireString(body.scope, "scope");
    const state = await resetDojo({
      scope,
      scenarioId: scope === "scenario" ? requireString(body.scenarioId, "scenarioId") : undefined,
    });
    return { state, message: scope === "all" ? "All dojo progress reset." : "Mission reset." };
  }
  throw Object.assign(new Error("Unknown mutation endpoint."), {
    statusCode: 404,
    code: "not_found",
  });
}

async function readJsonBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 32_768) {
      throw Object.assign(new Error("Request body exceeds 32 KB."), {
        statusCode: 413,
        code: "payload_too_large",
      });
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Body must be a JSON object.");
    }
    return parsed;
  } catch (error) {
    throw requestError(`Invalid JSON body: ${error.message}`);
  }
}

function requireString(value, field) {
  if (typeof value !== "string" || value.length === 0 || value.length > 100) {
    throw requestError(`${field} must be a non-empty string of at most 100 characters.`);
  }
  return value;
}

function requireInteger(value, field) {
  if (!Number.isInteger(value)) throw requestError(`${field} must be an integer.`);
  return value;
}

function requestError(message) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code: "invalid_input",
  });
}

function setSecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'"
  );
}

function serveAsset(response, filename) {
  const filePath = join(assetDirectory, filename);
  const contentType =
    extname(filePath) === ".css"
      ? "text/css; charset=utf-8"
      : "text/javascript; charset=utf-8";
  response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
  createReadStream(filePath)
    .on("error", () => response.destroy())
    .pipe(response);
}

function sendJson(response, status, value) {
  return send(response, status, "application/json; charset=utf-8", JSON.stringify(value));
}

function send(response, status, contentType, body) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function broadcast(clients, eventName, payload) {
  const encoded = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) client.write(encoded);
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
