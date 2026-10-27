import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryHome = await mkdtemp(join(tmpdir(), "cloud-architect-dojo-"));
process.env.COPILOT_HOME = temporaryHome;

const { startCanvasServer } = await import("../canvas-server.mjs");

let server;
try {
  server = await startCanvasServer({ instanceId: "smoke-test" });
  assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);

  const initial = await request(server.url, "/api/bootstrap");
  assert.equal(initial.status, 200);
  assert.equal(initial.body.scenarios.length, 4);
  assert.equal(initial.body.activeScenario.id, "url-shortener");
  assert.equal(initial.body.scenarioProgress.selectedComponents.length, 0);

  const selected = await request(server.url, "/api/scenario/select", {
    scenarioId: "url-shortener",
  });
  assert.equal(selected.status, 200);

  for (const componentId of ["lb", "api", "cache", "kv"]) {
    const response = await request(server.url, "/api/architecture/toggle", {
      scenarioId: "url-shortener",
      componentId,
    });
    assert.equal(response.status, 200);
  }

  const built = await request(server.url, "/api/bootstrap");
  assert.equal(built.body.architecture.status, "ready");
  assert.deepEqual(
    [...built.body.scenarioProgress.selectedComponents].sort(),
    ["api", "cache", "kv", "lb"]
  );

  const beforeLatency = built.body.architecture.metrics.latency;
  const incident = await request(server.url, "/api/event/apply", {
    scenarioId: "url-shortener",
    eventId: "viral-spike",
  });
  assert.equal(incident.status, 200);
  assert.ok(incident.body.architecture.metrics.latency > beforeLatency);

  const answer = await request(server.url, "/api/quiz/answer", {
    scenarioId: "url-shortener",
    questionId: "short-cache",
    answerIndex: 0,
  });
  assert.equal(answer.status, 200);
  assert.equal(answer.body.scenarioProgress.answers["short-cache"].correct, true);
  assert.equal(answer.body.progress.xp, 25);

  const invalid = await request(server.url, "/api/event/apply", {
    scenarioId: "url-shortener",
    eventId: "not-an-event",
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, "unknown_event");

  const malformed = await fetch(new URL("/api/scenario/select", server.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);

  const progressPath = join(
    temporaryHome,
    "extensions",
    "cloud-architect-dojo",
    "artifacts",
    "progress.json"
  );
  const persisted = JSON.parse(await readFile(progressPath, "utf8"));
  assert.ok(persisted.scenarios["url-shortener"].selectedComponents.includes("cache"));

  await server.close();
  server = undefined;

  const rehydratedServer = await startCanvasServer({ instanceId: "smoke-rehydrate" });
  server = rehydratedServer;
  const rehydrated = await request(server.url, "/api/bootstrap");
  assert.ok(rehydrated.body.scenarioProgress.selectedComponents.includes("cache"));
  assert.equal(rehydrated.body.progress.xp, 25);

  console.log("Cloud Architect Dojo smoke test passed.");
} finally {
  if (server) await server.close();
  await rm(temporaryHome, { recursive: true, force: true });
}

async function request(baseUrl, path, body) {
  const response = await fetch(new URL(path, baseUrl), {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
