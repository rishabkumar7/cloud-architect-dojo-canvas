import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_PROGRESS, SCENARIO_BY_ID, emptyScenarioState } from "./data.mjs";

const extensionHome = join(
  process.env.COPILOT_HOME || join(homedir(), ".copilot"),
  "extensions",
  "cloud-architect-dojo",
  "artifacts"
);
const progressPath = join(extensionHome, "progress.json");

let writeChain = Promise.resolve();

export async function readProgress() {
  try {
    const raw = await readFile(progressPath, "utf8");
    return normalizeProgress(JSON.parse(raw));
  } catch (error) {
    if (error?.code === "ENOENT") return structuredClone(DEFAULT_PROGRESS);
    if (error instanceof SyntaxError) {
      throw new Error(`Progress file is not valid JSON: ${progressPath}`);
    }
    throw error;
  }
}

export function updateProgress(mutator) {
  const operation = writeChain.then(async () => {
    const progress = await readProgress();
    const result = await mutator(progress);
    progress.lastUpdatedAt = new Date().toISOString();
    await persist(progress);
    return result ?? progress;
  });
  writeChain = operation.catch(() => undefined);
  return operation;
}

export async function resetProgress(scope = "all", scenarioId) {
  return updateProgress((progress) => {
    if (scope === "all") {
      Object.assign(progress, structuredClone(DEFAULT_PROGRESS));
      return progress;
    }
    assertScenario(scenarioId);
    delete progress.scenarios[scenarioId];
    progress.completedScenarios = progress.completedScenarios.filter((id) => id !== scenarioId);
    if (progress.activeScenarioId === scenarioId) progress.activeScenarioId = "url-shortener";
    return progress;
  });
}

export function ensureScenarioState(progress, scenarioId) {
  assertScenario(scenarioId);
  progress.scenarios[scenarioId] ??= emptyScenarioState();
  return progress.scenarios[scenarioId];
}

export function assertScenario(scenarioId) {
  if (!SCENARIO_BY_ID.has(scenarioId)) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }
}

export function getProgressPath() {
  return progressPath;
}

async function persist(progress) {
  await mkdir(dirname(progressPath), { recursive: true });
  const temporaryPath = `${progressPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
  await rename(temporaryPath, progressPath);
}

function normalizeProgress(input) {
  const progress = {
    ...structuredClone(DEFAULT_PROGRESS),
    ...(input && typeof input === "object" ? input : {}),
  };
  progress.scenarios =
    progress.scenarios && typeof progress.scenarios === "object" ? progress.scenarios : {};
  progress.completedScenarios = Array.isArray(progress.completedScenarios)
    ? progress.completedScenarios.filter((id) => SCENARIO_BY_ID.has(id))
    : [];
  if (!SCENARIO_BY_ID.has(progress.activeScenarioId)) {
    progress.activeScenarioId = "url-shortener";
  }
  progress.xp = Number.isFinite(progress.xp) ? Math.max(0, Math.round(progress.xp)) : 0;
  progress.streak = Number.isFinite(progress.streak) ? Math.max(0, Math.round(progress.streak)) : 0;
  for (const scenarioId of Object.keys(progress.scenarios)) {
    if (!SCENARIO_BY_ID.has(scenarioId)) {
      delete progress.scenarios[scenarioId];
      continue;
    }
    const stored = progress.scenarios[scenarioId];
    const normalized = {
      ...emptyScenarioState(),
      ...(stored && typeof stored === "object" ? stored : {}),
    };
    const scenario = SCENARIO_BY_ID.get(scenarioId);
    normalized.selectedComponents = Array.isArray(normalized.selectedComponents)
      ? normalized.selectedComponents.filter((id) =>
          scenario.components.some((component) => component.id === id)
        )
      : [];
    normalized.appliedEvents = Array.isArray(normalized.appliedEvents)
      ? normalized.appliedEvents.filter((id) => scenario.events.some((event) => event.id === id))
      : [];
    normalized.answers =
      normalized.answers && typeof normalized.answers === "object" ? normalized.answers : {};
    normalized.score = Number.isFinite(normalized.score)
      ? Math.max(0, Math.min(100, Math.round(normalized.score)))
      : 0;
    normalized.completed = normalized.completed === true;
    progress.scenarios[scenarioId] = normalized;
  }
  return progress;
}
