const app = document.querySelector("#app");
const toastRegion = document.querySelector("#toast-region");

let state;
let view = "dashboard";
let pending = false;

bootstrap();

async function bootstrap() {
  try {
    state = await api("/api/bootstrap");
    const requestedView = new URLSearchParams(location.search).get("view");
    view = requestedView === "workspace"
      ? "workspace"
      : requestedView === "dashboard"
        ? "dashboard"
        : state.scenarioProgress.selectedComponents.length > 0
          ? "workspace"
          : "dashboard";
    render();
    connectEvents();
  } catch (error) {
    renderFatal(error);
  }
}

function connectEvents() {
  const source = new EventSource("/events");
  source.addEventListener("state", (event) => {
    state = JSON.parse(event.data);
    render();
  });
  source.onerror = () => source.close();
}

function render() {
  app.setAttribute("aria-busy", pending ? "true" : "false");
  app.innerHTML = `${header()}<main id="main">${view === "dashboard" ? dashboard() : workspace()}</main>`;
  bindInteractions();
}

function header() {
  const completion = Math.round(
    (state.progress.completedScenarios.length / state.scenarios.length) * 100
  );
  return `
    <header class="topbar">
      <button class="brand-button" data-action="dashboard" aria-label="Open dojo dashboard">
        <span class="brand-mark" aria-hidden="true">CAD</span>
        <span><strong>Cloud Architect</strong><small>DOJO</small></span>
      </button>
      <div class="header-progress" aria-label="${completion}% course completion">
        <span class="progress-track"><span style="width:${completion}%"></span></span>
        <strong>${completion}%</strong>
      </div>
      <div class="stat-pill" title="Experience points"><span aria-hidden="true">✦</span>${state.progress.xp} XP</div>
      <div class="stat-pill" title="Scenario streak"><span aria-hidden="true">◉</span>${state.progress.streak}</div>
    </header>
  `;
}

function dashboard() {
  const next = state.scenarios.find((scenario) => !scenario.completed) ?? state.scenarios.at(-1);
  return `
    <section class="hero">
      <div class="hero-copy">
        <span class="overline">ARCHITECTURE TRAINING GROUND</span>
        <h1>Build systems that<br /><em>survive reality.</em></h1>
        <p>Learn cloud architecture by making decisions, breaking your design, and understanding the tradeoffs that matter.</p>
        <button class="primary-button" data-scenario="${escapeAttr(next.id)}">
          ${next.score > 0 ? "Continue training" : "Enter the dojo"} <span aria-hidden="true">→</span>
        </button>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <div class="orbit orbit-one"></div>
        <div class="orbit orbit-two"></div>
        <div class="cloud-core">
          <span class="core-label">DESIGN</span><strong>RESILIENT</strong><span class="core-label">SYSTEMS</span>
        </div>
        <div class="float-node node-a">EDGE</div>
        <div class="float-node node-b">DATA</div>
        <div class="float-node node-c">EVENTS</div>
      </div>
    </section>
    <section class="dashboard-section" aria-labelledby="missions-title">
      <div class="section-heading">
        <div><span class="overline">YOUR PATH</span><h2 id="missions-title">Architecture missions</h2></div>
        <p>${state.progress.completedScenarios.length} of ${state.scenarios.length} mastered</p>
      </div>
      <div class="scenario-grid">${state.scenarios.map(scenarioCard).join("")}</div>
    </section>
    <section class="principles">
      <article><span>01</span><h3>Design</h3><p>Choose services intentionally. Every component spends budget and adds operations.</p></article>
      <article><span>02</span><h3>Disrupt</h3><p>Apply realistic traffic and failure events. See where your assumptions break.</p></article>
      <article><span>03</span><h3>Explain</h3><p>Use checkpoints and tradeoffs to turn a diagram into durable judgment.</p></article>
    </section>
  `;
}

function scenarioCard(scenario) {
  const status = scenario.completed ? "mastered" : scenario.score > 0 ? "in progress" : "new";
  return `
    <button class="scenario-card ${scenario.completed ? "is-complete" : ""}" data-scenario="${escapeAttr(scenario.id)}">
      <span class="scenario-index">0${scenario.order}</span>
      <span class="scenario-icon" aria-hidden="true">${scenario.icon}</span>
      <span class="scenario-meta">${escapeHtml(scenario.eyebrow)} · ${escapeHtml(scenario.difficulty)}</span>
      <strong>${escapeHtml(scenario.title)}</strong>
      <span class="scenario-summary">${escapeHtml(scenario.summary)}</span>
      <span class="concept-row">${scenario.concepts.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</span>
      <span class="scenario-footer"><span>${status}</span><b>${scenario.score || "—"}</b></span>
    </button>
  `;
}

function workspace() {
  const scenario = state.activeScenario;
  const architecture = state.architecture;
  return `
    <section class="workspace-header">
      <button class="back-button" data-action="dashboard">← Missions</button>
      <div>
        <span class="overline">MISSION 0${scenario.order} · ${escapeHtml(scenario.difficulty)}</span>
        <h1>${escapeHtml(scenario.title)}</h1>
        <p>${escapeHtml(scenario.mission)}</p>
      </div>
      <div class="score-ring ${architecture.status}">
        <strong>${architecture.score}</strong><span>DESIGN SCORE</span>
      </div>
    </section>
    <nav class="workspace-tabs" aria-label="Mission workflow">
      <a href="#build">01 Build</a><a href="#simulate">02 Simulate</a><a href="#learn">03 Learn</a>
      <button data-action="reset-scenario">Reset</button>
    </nav>
    <section id="build" class="build-grid">
      <aside class="component-panel">
        <div class="panel-heading">
          <div><span class="overline">COMPONENTS</span><h2>Choose your stack</h2></div>
          <span class="budget ${architecture.spent > architecture.budget ? "over" : ""}">${architecture.spent}/${architecture.budget} pts</span>
        </div>
        <p class="panel-intro">Click components to add or remove them. Aim for a resilient design without spending blindly.</p>
        <div class="component-list">${scenario.components.map(componentCard).join("")}</div>
      </aside>
      <section class="topology-panel" aria-labelledby="topology-title">
        <div class="panel-heading">
          <div><span class="overline">LIVE TOPOLOGY</span><h2 id="topology-title">Architecture workspace</h2></div>
          <span class="status-badge ${architecture.status}">${statusLabel(architecture.status)}</span>
        </div>
        ${topology()}${metricStrip()}
        <div class="coach-card">
          <span class="coach-icon" aria-hidden="true">道</span>
          <div><span class="overline">DOJO COACH</span><p>${escapeHtml(architecture.feedback[0])}</p></div>
        </div>
      </section>
    </section>
    <section id="simulate" class="content-section">
      <div class="section-heading">
        <div><span class="overline">PRESSURE TEST</span><h2>What happens when…</h2></div>
        <p>Incidents stack. Change the architecture to clear the simulation.</p>
      </div>
      <div class="event-grid">${scenario.events.map(eventCard).join("")}</div>
    </section>
    <section id="learn" class="learning-grid">
      <article class="lesson-card">
        <span class="overline">CORE LESSON</span><h2>The architecture principle</h2>
        <p>${escapeHtml(scenario.lesson)}</p>
        <div class="objectives">${scenario.objectives.map((item) => `<span><b>✓</b>${escapeHtml(item)}</span>`).join("")}</div>
      </article>
      <article class="tradeoff-card">
        <span class="overline">TRADEOFF MAP</span><h2>No choice is free</h2>
        <div class="tradeoff-table">
          ${scenario.tradeoffs.map(([choice, gain, cost]) => `
            <div><strong>${escapeHtml(choice)}</strong><span class="gain">+ ${escapeHtml(gain)}</span><span class="cost">− ${escapeHtml(cost)}</span></div>
          `).join("")}
        </div>
      </article>
    </section>
    <section class="quiz-section">
      <div class="section-heading"><div><span class="overline">CHECKPOINT</span><h2>Prove the concept</h2></div></div>
      <div class="quiz-grid">${scenario.quiz.map(quizCard).join("")}</div>
    </section>
  `;
}

function componentCard(component) {
  const selected = state.scenarioProgress.selectedComponents.includes(component.id);
  return `
    <button class="component-card ${selected ? "is-selected" : ""}" data-component="${escapeAttr(component.id)}" aria-pressed="${selected}">
      <span class="component-glyph type-${escapeAttr(component.type)}" aria-hidden="true">${componentGlyph(component.type)}</span>
      <span class="component-copy"><strong>${escapeHtml(component.name)}</strong><small>${escapeHtml(component.description)}</small></span>
      <span class="component-cost">${component.cost}</span>
    </button>
  `;
}

function topology() {
  const selected = new Set(state.scenarioProgress.selectedComponents);
  const components = state.activeScenario.components.filter((item) => selected.has(item.id));
  if (components.length === 0) {
    return `
      <div class="empty-topology">
        <div class="empty-glyph" aria-hidden="true">＋</div>
        <h3>Your canvas is clear</h3>
        <p>Select components from the stack to assemble the first version of your system.</p>
      </div>
    `;
  }
  return `
    <div class="topology" role="img" aria-label="Selected architecture components arranged by layer">
      ${["edge", "compute", "async", "data", "ops"].map((type) => {
        const layer = components.filter((item) => item.type === type);
        if (!layer.length) return "";
        return `
          <div class="topology-layer">
            <span class="layer-label">${type}</span>
            <div class="layer-nodes">${layer.map((item) => `
              <button class="topology-node type-${escapeAttr(type)}" data-component="${escapeAttr(item.id)}" title="Remove ${escapeAttr(item.name)}">
                <span aria-hidden="true">${componentGlyph(type)}</span><strong>${escapeHtml(item.name)}</strong>
              </button>
            `).join("")}</div>
          </div>
        `;
      }).filter(Boolean).join('<div class="layer-arrow" aria-hidden="true">↓</div>')}
    </div>
  `;
}

function metricStrip() {
  const metrics = state.architecture.metrics;
  const target = state.activeScenario.targetMetrics;
  return `
    <div class="metric-strip">
      ${metric("p95 latency", `${formatNumber(metrics.latency)} ms`, metrics.latency <= target.latency)}
      ${metric("availability", `${metrics.availability}%`, metrics.availability >= target.availability)}
      ${metric("throughput", formatThroughput(metrics.throughput), metrics.throughput >= target.throughput)}
      ${metric("monthly cost", `$${metrics.cost}k`, metrics.cost <= target.cost)}
    </div>
  `;
}

function metric(label, value, healthy) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><i class="${healthy ? "healthy" : "warning"}">${healthy ? "on target" : "needs work"}</i></div>`;
}

function eventCard(event) {
  const applied = state.scenarioProgress.appliedEvents.includes(event.id);
  return `
    <button class="event-card ${applied ? "is-applied" : ""}" data-event="${escapeAttr(event.id)}" ${applied ? "disabled" : ""}>
      <span class="event-kind">${escapeHtml(event.kind)}</span><strong>${escapeHtml(event.title)}</strong>
      <span>${escapeHtml(event.description)}</span><b>${applied ? "Incident active" : "Run simulation →"}</b>
    </button>
  `;
}

function quizCard(question, index) {
  const answer = state.scenarioProgress.answers[question.id];
  return `
    <article class="quiz-card">
      <span class="quiz-number">0${index + 1}</span><h3>${escapeHtml(question.prompt)}</h3>
      <div class="answer-list">
        ${question.options.map((option, answerIndex) => `
          <button data-question="${escapeAttr(question.id)}" data-answer="${answerIndex}"
            class="${answer?.answerIndex === answerIndex ? (answer.correct ? "correct" : "incorrect") : ""}">
            <span>${String.fromCharCode(65 + answerIndex)}</span>${escapeHtml(option)}
          </button>
        `).join("")}
      </div>
      ${answer ? `<p class="quiz-explanation ${answer.correct ? "correct" : "incorrect"}">${escapeHtml(answer.explanation)}</p>` : ""}
    </article>
  `;
}

function bindInteractions() {
  document.querySelectorAll("[data-action='dashboard']").forEach((button) => {
    button.addEventListener("click", () => {
      view = "dashboard";
      render();
      scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  document.querySelectorAll("[data-scenario]").forEach((button) => {
    button.addEventListener("click", () =>
      mutate("/api/scenario/select", { scenarioId: button.dataset.scenario }, "workspace")
    );
  });
  document.querySelectorAll("[data-component]").forEach((button) => {
    button.addEventListener("click", () =>
      mutate("/api/architecture/toggle", {
        scenarioId: state.activeScenario.id,
        componentId: button.dataset.component,
      })
    );
  });
  document.querySelectorAll("[data-event]").forEach((button) => {
    button.addEventListener("click", () =>
      mutate("/api/event/apply", {
        scenarioId: state.activeScenario.id,
        eventId: button.dataset.event,
      })
    );
  });
  document.querySelectorAll("[data-question]").forEach((button) => {
    button.addEventListener("click", () =>
      mutate("/api/quiz/answer", {
        scenarioId: state.activeScenario.id,
        questionId: button.dataset.question,
        answerIndex: Number(button.dataset.answer),
      })
    );
  });
  document.querySelector("[data-action='reset-scenario']")?.addEventListener("click", () => {
    mutate("/api/reset", { scope: "scenario", scenarioId: state.activeScenario.id });
  });
}

async function mutate(path, body, nextView) {
  if (pending) return;
  pending = true;
  app.setAttribute("aria-busy", "true");
  try {
    const result = await api(path, { method: "POST", body: JSON.stringify(body) });
    const { message, ...nextState } = result;
    state = nextState;
    if (nextView) view = nextView;
    render();
    if (message) toast(message);
  } catch (error) {
    toast(error.message, "error");
  } finally {
    pending = false;
    app.setAttribute("aria-busy", "false");
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? `Request failed (${response.status}).`);
  return payload;
}

function toast(message, kind = "info") {
  const element = document.createElement("div");
  element.className = `toast ${kind}`;
  element.textContent = message;
  toastRegion.append(element);
  setTimeout(() => element.remove(), 4200);
}

function renderFatal(error) {
  app.innerHTML = `
    <main class="fatal-state">
      <span class="brand-mark">CAD</span><h1>The dojo could not open.</h1>
      <p>${escapeHtml(error.message)}</p><button class="primary-button" data-reload>Try again</button>
    </main>
  `;
  document.querySelector("[data-reload]")?.addEventListener("click", () => location.reload());
}

function componentGlyph(type) {
  return { edge: "◇", compute: "⬡", data: "▤", async: "⌁", ops: "◉" }[type] ?? "□";
}

function statusLabel(status) {
  return {
    empty: "Awaiting design",
    "at-risk": "At risk",
    promising: "Promising",
    ready: "Mission ready",
  }[status];
}

function formatThroughput(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M rps`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K rps`;
  return `${value} rps`;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
