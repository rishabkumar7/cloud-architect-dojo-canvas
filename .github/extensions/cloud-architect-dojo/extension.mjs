import {
  CanvasError,
  createCanvas,
  joinSession,
} from "@github/copilot-sdk/extension";
import { SCENARIOS, SCENARIO_BY_ID } from "./data.mjs";
import {
  answerQuestion,
  applyEvent,
  getDojoState,
  listScenarios,
  resetDojo,
  selectScenario,
  setComponent,
} from "./dojo-service.mjs";
import { startCanvasServer } from "./canvas-server.mjs";
import { getProgressPath } from "./state-store.mjs";

const servers = new Map();
const scenarioIdSchema = {
  type: "string",
  enum: SCENARIOS.map((scenario) => scenario.id),
};

const canvas = createCanvas({
  id: "cloud-architect-dojo",
  displayName: "Cloud Architect Dojo",
  description:
    "An interactive cloud architecture learning game with topology building, incident simulations, tradeoffs, quizzes, and durable progress.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      scenarioId: scenarioIdSchema,
      view: {
        type: "string",
        enum: ["dashboard", "workspace"],
        default: "dashboard",
      },
    },
  },
  actions: [
    {
      name: "get_state",
      description: "Inspect learner progress, the active scenario, selected components, and metrics.",
      inputSchema: emptyObjectSchema(),
      handler: async () => getDojoState(),
    },
    {
      name: "list_scenarios",
      description: "List available architecture scenarios and their completion status.",
      inputSchema: emptyObjectSchema(),
      handler: async () => listScenarios(),
    },
    {
      name: "set_scenario",
      description: "Select a scenario and return its current architecture state.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["scenarioId"],
        properties: { scenarioId: scenarioIdSchema },
      },
      handler: async (ctx) => selectScenario(ctx.input.scenarioId),
    },
    {
      name: "set_component",
      description: "Add or remove one architecture component in a scenario.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["scenarioId", "componentId", "selected"],
        properties: {
          scenarioId: scenarioIdSchema,
          componentId: { type: "string", minLength: 1, maxLength: 100 },
          selected: { type: "boolean" },
        },
      },
      handler: async (ctx) => {
        try {
          return await setComponent(ctx.input);
        } catch (error) {
          throw toCanvasError(error);
        }
      },
    },
    {
      name: "apply_event",
      description: "Apply a traffic or failure event and inspect its impact.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["scenarioId", "eventId"],
        properties: {
          scenarioId: scenarioIdSchema,
          eventId: { type: "string", minLength: 1, maxLength: 100 },
        },
      },
      handler: async (ctx) => {
        try {
          return await applyEvent(ctx.input);
        } catch (error) {
          throw toCanvasError(error);
        }
      },
    },
    {
      name: "answer_checkpoint",
      description: "Answer a scenario knowledge checkpoint and receive the teaching explanation.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["scenarioId", "questionId", "answerIndex"],
        properties: {
          scenarioId: scenarioIdSchema,
          questionId: { type: "string", minLength: 1, maxLength: 100 },
          answerIndex: { type: "integer", minimum: 0 },
        },
      },
      handler: async (ctx) => {
        try {
          return await answerQuestion(ctx.input);
        } catch (error) {
          throw toCanvasError(error);
        }
      },
    },
    {
      name: "reset_progress",
      description: "Reset one scenario or all durable Cloud Architect Dojo progress.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["scope"],
        properties: {
          scope: { type: "string", enum: ["scenario", "all"] },
          scenarioId: scenarioIdSchema,
        },
      },
      handler: async (ctx) => {
        try {
          return await resetDojo(ctx.input);
        } catch (error) {
          throw toCanvasError(error);
        }
      },
    },
  ],
  open: async (ctx) => {
    const scenarioId = ctx.input?.scenarioId;
    if (scenarioId) await selectScenario(scenarioId);

    let entry = servers.get(ctx.instanceId);
    if (!entry) {
      entry = await startCanvasServer({ instanceId: ctx.instanceId });
      servers.set(ctx.instanceId, entry);
    }

    const active = SCENARIO_BY_ID.get((await getDojoState()).activeScenario.id);
    const requestedView = ctx.input?.view ?? "dashboard";
    return {
      title: "Cloud Architect Dojo",
      status: active ? `${active.eyebrow} · ${active.title}` : "Ready to train",
      url: `${entry.url}?view=${encodeURIComponent(requestedView)}`,
    };
  },
  onClose: async (ctx) => {
    const entry = servers.get(ctx.instanceId);
    if (!entry) return;
    servers.delete(ctx.instanceId);
    await entry.close();
  },
});

const session = await joinSession({ canvases: [canvas] });
session.log(`Cloud Architect Dojo is ready. Progress: ${getProgressPath()}`, {
  level: "info",
  ephemeral: true,
});

function emptyObjectSchema() {
  return { type: "object", additionalProperties: false, properties: {} };
}

function toCanvasError(error) {
  if (error instanceof CanvasError) return error;
  return new CanvasError(error?.code ?? "dojo_error", error?.message ?? "Cloud Architect Dojo failed.");
}
