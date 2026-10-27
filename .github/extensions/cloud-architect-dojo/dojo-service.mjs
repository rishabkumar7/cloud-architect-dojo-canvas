import {
  SCENARIOS,
  SCENARIO_BY_ID,
  emptyScenarioState,
  evaluateArchitecture,
  publicScenario,
} from "./data.mjs";
import {
  assertScenario,
  ensureScenarioState,
  readProgress,
  resetProgress,
  updateProgress,
} from "./state-store.mjs";

export async function getDojoState(progress) {
  progress ??= await readProgress();
  const activeScenario = SCENARIO_BY_ID.get(progress.activeScenarioId) ?? SCENARIOS[0];
  const current = progress.scenarios[activeScenario.id] ?? emptyScenarioState();
  return {
    product: {
      name: "Cloud Architect Dojo",
      tagline: "Train your architecture instincts.",
      version: 1,
    },
    scenarios: SCENARIOS.map((scenario) => ({
      id: scenario.id,
      order: scenario.order,
      title: scenario.title,
      eyebrow: scenario.eyebrow,
      difficulty: scenario.difficulty,
      icon: scenario.icon,
      summary: scenario.summary,
      concepts: scenario.concepts,
      completed: progress.completedScenarios.includes(scenario.id),
      score: progress.scenarios[scenario.id]?.score ?? 0,
    })),
    activeScenario: publicScenario(activeScenario),
    architecture: evaluateArchitecture(
      activeScenario,
      current.selectedComponents,
      current.appliedEvents
    ),
    scenarioProgress: current,
    progress: {
      xp: progress.xp,
      streak: progress.streak,
      completedScenarios: progress.completedScenarios,
      lastUpdatedAt: progress.lastUpdatedAt,
    },
  };
}

export async function listScenarios() {
  const progress = await readProgress();
  return SCENARIOS.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    difficulty: scenario.difficulty,
    concepts: scenario.concepts,
    completed: progress.completedScenarios.includes(scenario.id),
    score: progress.scenarios[scenario.id]?.score ?? 0,
  }));
}

export async function selectScenario(scenarioId) {
  assertScenario(scenarioId);
  const progress = await updateProgress((draft) => {
    draft.activeScenarioId = scenarioId;
    ensureScenarioState(draft, scenarioId);
    return draft;
  });
  return getDojoState(progress);
}

export async function setComponent({ scenarioId, componentId, selected }) {
  const scenario = getScenario(scenarioId);
  if (!scenario.components.some((item) => item.id === componentId)) {
    throw dojoError(
      "unknown_component",
      `Component "${componentId}" does not exist in scenario "${scenarioId}".`
    );
  }
  const progress = await updateProgress((draft) => {
    draft.activeScenarioId = scenarioId;
    const current = ensureScenarioState(draft, scenarioId);
    const components = new Set(current.selectedComponents);
    selected ? components.add(componentId) : components.delete(componentId);
    current.selectedComponents = [...components];
    current.appliedEvents = [];
    evaluateAndComplete(draft, scenario, current);
    return draft;
  });
  return getDojoState(progress);
}

export async function toggleComponent({ scenarioId, componentId }) {
  const progress = await readProgress();
  const current = progress.scenarios[scenarioId] ?? emptyScenarioState();
  return setComponent({
    scenarioId,
    componentId,
    selected: !current.selectedComponents.includes(componentId),
  });
}

export async function applyEvent({ scenarioId, eventId }) {
  const scenario = getScenario(scenarioId);
  if (!scenario.events.some((item) => item.id === eventId)) {
    throw dojoError("unknown_event", `Event "${eventId}" does not exist in scenario "${scenarioId}".`);
  }
  const progress = await updateProgress((draft) => {
    draft.activeScenarioId = scenarioId;
    const current = ensureScenarioState(draft, scenarioId);
    if (!current.appliedEvents.includes(eventId)) current.appliedEvents.push(eventId);
    evaluateAndComplete(draft, scenario, current);
    return draft;
  });
  return getDojoState(progress);
}

export async function answerQuestion({ scenarioId, questionId, answerIndex }) {
  const scenario = getScenario(scenarioId);
  const question = scenario.quiz.find((item) => item.id === questionId);
  if (!question) throw dojoError("unknown_question", `Unknown checkpoint: ${questionId}`);
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= question.options.length) {
    throw dojoError("invalid_answer", "answerIndex is outside the available options.");
  }
  const isCorrect = answerIndex === question.answer;
  const progress = await updateProgress((draft) => {
    draft.activeScenarioId = scenarioId;
    const current = ensureScenarioState(draft, scenarioId);
    const firstCorrectAnswer = current.answers[questionId]?.correct !== true && isCorrect;
    current.answers[questionId] = {
      answerIndex,
      correct: isCorrect,
      explanation: question.explanation,
    };
    if (firstCorrectAnswer) draft.xp += 25;
    evaluateAndComplete(draft, scenario, current);
    return draft;
  });
  return {
    state: await getDojoState(progress),
    correct: isCorrect,
    explanation: question.explanation,
  };
}

export async function resetDojo({ scope, scenarioId }) {
  if (!["scenario", "all"].includes(scope)) {
    throw dojoError("invalid_scope", 'scope must be "scenario" or "all".');
  }
  if (scope === "scenario" && !scenarioId) {
    throw dojoError("scenario_required", "scenarioId is required when resetting one scenario.");
  }
  const progress = await resetProgress(scope, scenarioId);
  return getDojoState(progress);
}

function getScenario(scenarioId) {
  try {
    assertScenario(scenarioId);
  } catch {
    throw dojoError("unknown_scenario", `Unknown scenario: ${scenarioId}`);
  }
  return SCENARIO_BY_ID.get(scenarioId);
}

function evaluateAndComplete(progress, scenario, current) {
  const evaluation = evaluateArchitecture(
    scenario,
    current.selectedComponents,
    current.appliedEvents
  );
  current.score = evaluation.score;
  const allAnswered = scenario.quiz.every((question) => current.answers[question.id]?.correct);
  const complete = evaluation.status === "ready" && allAnswered;
  if (complete && !current.completed) {
    current.completed = true;
    progress.xp += 100 + scenario.order * 25;
    progress.streak += 1;
    if (!progress.completedScenarios.includes(scenario.id)) {
      progress.completedScenarios.push(scenario.id);
    }
  } else if (!complete) {
    current.completed = false;
  }
}

function dojoError(code, message) {
  return Object.assign(new Error(message), { code, statusCode: 400 });
}
