import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryHome = await mkdtemp(join(tmpdir(), "cloud-architect-dojo-contract-"));
process.env.COPILOT_HOME = temporaryHome;

try {
  await import("../extension.mjs");
  const canvas = globalThis.__cloudArchitectDojoCanvas;

  assert.ok(canvas, "createCanvas should receive the canvas declaration");
  assert.equal(canvas.id, "cloud-architect-dojo");
  assert.equal(canvas.displayName, "Cloud Architect Dojo");
  assert.equal(globalThis.__cloudArchitectDojoSession.canvases[0], canvas);
  assert.match(globalThis.__cloudArchitectDojoLog.message, /Cloud Architect Dojo is ready/);

  const actionNames = canvas.actions.map((action) => action.name);
  assert.deepEqual(actionNames, [
    "get_state",
    "list_scenarios",
    "set_scenario",
    "set_component",
    "apply_event",
    "answer_checkpoint",
    "reset_progress",
  ]);
  assert.ok(canvas.actions.every((action) => typeof action.handler === "function"));
  assert.ok(canvas.actions.every((action) => !action.name.startsWith("canvas.")));

  const opened = await canvas.open({
    input: { scenarioId: "url-shortener", view: "workspace" },
    instanceId: "contract-test",
  });
  assert.match(opened.url, /^http:\/\/127\.0\.0\.1:\d+\/\?view=workspace$/);
  assert.equal(opened.title, "Cloud Architect Dojo");

  const getState = action(canvas, "get_state");
  const initial = await getState.handler({ input: {}, instanceId: "contract-test" });
  assert.equal(initial.activeScenario.id, "url-shortener");

  const setScenario = action(canvas, "set_scenario");
  const global = await setScenario.handler({
    input: { scenarioId: "global-media" },
    instanceId: "contract-test",
  });
  assert.equal(global.activeScenario.id, "global-media");

  const setComponent = action(canvas, "set_component");
  await assert.rejects(
    () =>
      setComponent.handler({
        input: { scenarioId: "global-media", componentId: "not-real", selected: true },
        instanceId: "contract-test",
      }),
    (error) => error.name === "CanvasError" && error.code === "unknown_component"
  );

  await canvas.onClose({ instanceId: "contract-test" });
  await assert.rejects(() => fetch(opened.url));

  console.log("Cloud Architect Dojo extension contract test passed.");
} finally {
  await rm(temporaryHome, { recursive: true, force: true });
}

function action(canvas, name) {
  const found = canvas.actions.find((item) => item.name === name);
  assert.ok(found, `Expected action ${name}`);
  return found;
}
