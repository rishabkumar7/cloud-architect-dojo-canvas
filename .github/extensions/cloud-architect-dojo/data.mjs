export const SCENARIOS = [
  {
    id: "url-shortener",
    order: 1,
    title: "Tiny Links, Big Traffic",
    eyebrow: "Foundations",
    difficulty: "Starter",
    icon: "↗",
    summary: "Design a low-latency URL shortener that stays fast as read traffic grows.",
    mission:
      "Create short links, redirect users in under 120 ms, and keep popular destinations hot without losing new writes.",
    concepts: ["Read-heavy systems", "Caching", "Key-value data", "Horizontal scaling"],
    budget: 8,
    objectives: [
      "Keep redirect latency below 120 ms",
      "Support 25K requests per second",
      "Preserve short-link durability",
    ],
    baseMetrics: { latency: 210, availability: 98.8, throughput: 6200, cost: 18 },
    targetMetrics: { latency: 120, availability: 99.9, throughput: 25000, cost: 48 },
    components: [
      component("dns", "Edge DNS", "edge", 1, "Routes users to a healthy entry point.", ["availability"]),
      component("lb", "Load Balancer", "edge", 1, "Spreads redirects across stateless API nodes.", ["availability", "throughput"]),
      component("api", "Stateless API", "compute", 2, "Generates IDs and handles redirect lookups.", ["throughput"]),
      component("cache", "Redis Cache", "data", 2, "Serves hot mappings without hitting storage.", ["latency", "throughput"]),
      component("kv", "Key-Value Store", "data", 2, "Persists short-code to URL mappings.", ["durability"]),
      component("sql", "Relational DB", "data", 3, "Offers transactions, but adds avoidable complexity here.", ["durability"]),
      component("queue", "Event Queue", "async", 1, "Buffers analytics away from the redirect path.", ["resilience"]),
      component("workers", "Analytics Workers", "compute", 1, "Processes click events asynchronously.", ["throughput"]),
    ],
    required: ["lb", "api", "cache", "kv"],
    recommended: ["dns", "queue", "workers"],
    discouraged: ["sql"],
    links: [
      ["dns", "lb"],
      ["lb", "api"],
      ["api", "cache"],
      ["cache", "kv"],
      ["api", "queue"],
      ["queue", "workers"],
    ],
    events: [
      event("viral-spike", "A link goes viral", "Traffic jumps 8× in three minutes.", "traffic", { latency: 95, throughput: -12000, availability: -0.7 }),
      event("cold-cache", "Cache fleet restarts", "The hot set is empty and every redirect reaches storage.", "cache", { latency: 140, throughput: -7000, cost: 8 }),
      event("id-collision", "ID collision detected", "Two writers generate the same short code.", "data", { availability: -1.4, latency: 35 }),
    ],
    quiz: [
      quiz(
        "short-read-path",
        "Why should redirect analytics be sent through a queue?",
        ["To make URLs shorter", "To keep analytics work off the synchronous read path", "To encrypt click data", "To replace the cache"],
        1,
        "Queues decouple non-critical analytics from the latency-sensitive redirect path. The tradeoff is delayed, eventually consistent analytics."
      ),
      quiz(
        "short-cache",
        "Which cache policy best fits a read-heavy hot-key workload?",
        ["Cache-aside with TTLs", "Write-only cache", "Disable eviction", "Cache every analytics event"],
        0,
        "Cache-aside keeps the application in control and lets popular mappings become hot naturally. TTL and eviction policy must balance freshness and memory."
      ),
    ],
    lesson:
      "Optimize the dominant path. Redirects vastly outnumber creates, so stateless compute, aggressive caching, and a simple durable key-value model beat a transaction-heavy design.",
    tradeoffs: [
      ["Cache-aside", "Excellent read latency and simple failure behavior", "Cold starts create database pressure"],
      ["Random IDs", "Easy distributed generation", "Collision handling and longer keys"],
      ["Async analytics", "Protects the critical path", "Metrics arrive later and require queue operations"],
    ],
  },
  {
    id: "ha-web-app",
    order: 2,
    title: "Always-On Launchpad",
    eyebrow: "Reliability",
    difficulty: "Intermediate",
    icon: "⬡",
    summary: "Build a highly available web platform across failure zones.",
    mission:
      "Launch a customer portal with no single point of failure, graceful degradation, and safe database failover.",
    concepts: ["Multi-AZ", "Health checks", "Replication", "Auto scaling"],
    budget: 11,
    objectives: [
      "Reach 99.95% availability",
      "Survive one availability-zone outage",
      "Keep p95 latency below 180 ms",
    ],
    baseMetrics: { latency: 260, availability: 97.5, throughput: 3800, cost: 22 },
    targetMetrics: { latency: 180, availability: 99.95, throughput: 12000, cost: 68 },
    components: [
      component("cdn", "CDN", "edge", 2, "Serves static assets near users.", ["latency", "availability"]),
      component("waf", "WAF", "edge", 1, "Filters malicious requests before compute.", ["resilience"]),
      component("lb", "Health-Aware LB", "edge", 1, "Removes unhealthy targets and balances zones.", ["availability"]),
      component("autoscale", "Auto Scaling Group", "compute", 3, "Maintains capacity across two or more zones.", ["availability", "throughput"]),
      component("sessions", "Session Store", "data", 1, "Keeps application instances stateless.", ["availability"]),
      component("primary-db", "Primary Database", "data", 2, "Stores transactional customer data.", ["durability"]),
      component("replica", "Standby Replica", "data", 2, "Provides synchronous failover capacity.", ["availability", "durability"]),
      component("observability", "Telemetry", "ops", 1, "Detects saturation and unhealthy dependencies.", ["resilience"]),
    ],
    required: ["lb", "autoscale", "primary-db", "replica"],
    recommended: ["cdn", "waf", "sessions", "observability"],
    discouraged: [],
    links: [
      ["cdn", "waf"],
      ["waf", "lb"],
      ["lb", "autoscale"],
      ["autoscale", "sessions"],
      ["autoscale", "primary-db"],
      ["primary-db", "replica"],
      ["autoscale", "observability"],
    ],
    events: [
      event("az-outage", "Availability zone fails", "Power loss removes half the compute fleet and the primary database host.", "failure", { latency: 65, availability: -4.2, throughput: -4200 }),
      event("deploy-regression", "Bad release rolls out", "New instances fail health checks under production load.", "deploy", { availability: -2.1, throughput: -2600 }),
      event("db-connections", "Connection pool exhausted", "A burst of requests consumes every database connection.", "data", { latency: 180, throughput: -3200 }),
    ],
    quiz: [
      quiz(
        "ha-stateless",
        "Why keep application servers stateless?",
        ["It removes the need for databases", "Any healthy instance can serve the next request", "It prevents all software bugs", "It guarantees zero latency"],
        1,
        "Externalized session state lets the load balancer route around failed instances. The tradeoff is another network dependency."
      ),
      quiz(
        "ha-failover",
        "What must be tested before relying on database failover?",
        ["Only the backup size", "DNS color", "Recovery time and application reconnection behavior", "CSS rendering"],
        2,
        "A replica is not a resilience strategy until failover timing, client retries, endpoint behavior, and data-loss bounds are exercised."
      ),
    ],
    lesson:
      "Availability is an end-to-end property. Redundant compute is not enough if sessions, database connections, or failover procedures remain single points of failure.",
    tradeoffs: [
      ["Multi-AZ compute", "Survives infrastructure loss", "Higher steady-state cost"],
      ["Synchronous replica", "Low recovery-point objective", "Write latency and cross-zone cost"],
      ["Aggressive health checks", "Fast traffic removal", "Transient faults may trigger unnecessary failover"],
    ],
  },
  {
    id: "event-orders",
    order: 3,
    title: "Order Stream Command",
    eyebrow: "Event-driven",
    difficulty: "Advanced",
    icon: "⌁",
    summary: "Coordinate orders, payments, inventory, and notifications without a distributed transaction.",
    mission:
      "Process orders reliably through independent services while handling retries, duplicates, poison messages, and partial failure.",
    concepts: ["Queues", "Idempotency", "Sagas", "Dead-letter handling"],
    budget: 13,
    objectives: [
      "Process 8K orders per minute",
      "Recover from poison messages",
      "Avoid duplicate payment capture",
    ],
    baseMetrics: { latency: 740, availability: 97.9, throughput: 1800, cost: 28 },
    targetMetrics: { latency: 520, availability: 99.9, throughput: 8000, cost: 78 },
    components: [
      component("gateway", "API Gateway", "edge", 1, "Authenticates and meters order submissions.", ["resilience"]),
      component("orders", "Order Service", "compute", 2, "Validates requests and records order intent.", ["durability"]),
      component("bus", "Event Bus", "async", 2, "Routes domain events to interested services.", ["throughput", "resilience"]),
      component("queue", "Durable Queue", "async", 2, "Buffers work and absorbs consumer slowdowns.", ["resilience", "throughput"]),
      component("workers", "Idempotent Workers", "compute", 2, "Safely retries payment and inventory steps.", ["resilience"]),
      component("state", "Saga State Store", "data", 2, "Tracks workflow progress and compensations.", ["durability"]),
      component("dlq", "Dead-Letter Queue", "async", 1, "Isolates repeatedly failing messages.", ["resilience"]),
      component("notifications", "Notification Service", "compute", 1, "Sends confirmations outside the transaction path.", ["latency"]),
    ],
    required: ["orders", "queue", "workers", "state", "dlq"],
    recommended: ["gateway", "bus", "notifications"],
    discouraged: [],
    links: [
      ["gateway", "orders"],
      ["orders", "bus"],
      ["bus", "queue"],
      ["queue", "workers"],
      ["workers", "state"],
      ["queue", "dlq"],
      ["bus", "notifications"],
    ],
    events: [
      event("flash-sale", "Flash sale begins", "Incoming orders rise 12× while inventory updates remain bounded.", "traffic", { latency: 230, throughput: -5000, cost: 14 }),
      event("poison-message", "Poison message loops", "One malformed event fails every retry and blocks its partition.", "queue", { latency: 310, availability: -2.4, throughput: -3800 }),
      event("payment-timeout", "Payment provider times out", "Responses are lost after some charges have succeeded.", "failure", { latency: 190, availability: -1.3 }),
    ],
    quiz: [
      quiz(
        "event-idempotency",
        "What makes retrying a payment command safe?",
        ["A shorter timeout", "An idempotency key stored with the result", "More queue partitions", "A larger payload"],
        1,
        "An idempotency key maps repeated attempts to the original outcome. This requires durable deduplication state and a defined retention window."
      ),
      quiz(
        "event-dlq",
        "What is the main purpose of a dead-letter queue?",
        ["Make every message faster", "Hide all errors", "Isolate exhausted failures for inspection and replay", "Replace monitoring"],
        2,
        "A DLQ protects healthy traffic from poison messages, but teams still need alarms, diagnosis, safe replay, and retention policies."
      ),
    ],
    lesson:
      "Event-driven systems trade immediate consistency for autonomy and resilience. Make retries, duplicate delivery, ordering boundaries, and compensation explicit design concerns.",
    tradeoffs: [
      ["At-least-once delivery", "Practical durability", "Consumers must be idempotent"],
      ["Saga workflow", "No global lock across services", "Compensation is domain-specific and observable"],
      ["More partitions", "Higher parallel throughput", "Ordering scope shrinks and operations get harder"],
    ],
  },
  {
    id: "global-media",
    order: 4,
    title: "Planet-Scale Premiere",
    eyebrow: "Global scale",
    difficulty: "Expert",
    icon: "◎",
    summary: "Deliver a live global media launch with origin protection and regional resilience.",
    mission:
      "Stream a premiere worldwide with fast startup, controlled origin load, regional failover, and predictable cost.",
    concepts: ["CDNs", "Multi-region", "Origin shielding", "Consistency"],
    budget: 16,
    objectives: [
      "Keep startup latency below 900 ms",
      "Sustain 2.5M concurrent viewers",
      "Continue through a regional outage",
    ],
    baseMetrics: { latency: 1900, availability: 96.8, throughput: 240000, cost: 42 },
    targetMetrics: { latency: 900, availability: 99.99, throughput: 2500000, cost: 120 },
    components: [
      component("geo-dns", "Geo DNS", "edge", 1, "Steers clients by health and geography.", ["availability", "latency"]),
      component("cdn", "Global CDN", "edge", 3, "Caches media near viewers.", ["latency", "throughput"]),
      component("shield", "Origin Shield", "edge", 2, "Collapses cache misses before they reach origin.", ["throughput", "resilience"]),
      component("primary-origin", "Primary Origin", "compute", 2, "Packages and serves the canonical stream.", ["throughput"]),
      component("secondary-origin", "Secondary Region", "compute", 3, "Provides independent warm failover capacity.", ["availability"]),
      component("object-store", "Replicated Object Store", "data", 2, "Durably stores segments and manifests.", ["durability", "availability"]),
      component("event-pipeline", "Playback Events", "async", 1, "Moves QoE telemetry off the delivery path.", ["resilience"]),
      component("adaptive", "Adaptive Bitrate", "compute", 2, "Matches quality to network conditions.", ["latency", "availability"]),
    ],
    required: ["geo-dns", "cdn", "shield", "primary-origin", "secondary-origin", "object-store"],
    recommended: ["event-pipeline", "adaptive"],
    discouraged: [],
    links: [
      ["geo-dns", "cdn"],
      ["cdn", "shield"],
      ["shield", "primary-origin"],
      ["shield", "secondary-origin"],
      ["primary-origin", "object-store"],
      ["secondary-origin", "object-store"],
      ["cdn", "event-pipeline"],
      ["primary-origin", "adaptive"],
    ],
    events: [
      event("premiere", "Premiere countdown ends", "Millions of viewers request the first segments simultaneously.", "traffic", { latency: 780, throughput: -1500000, cost: 38 }),
      event("region-loss", "Primary region disappears", "Network isolation removes the active origin and control plane.", "failure", { latency: 620, availability: -8.5, throughput: -900000 }),
      event("miss-storm", "Cache miss storm", "A manifest change invalidates popular objects across edge locations.", "cache", { latency: 940, throughput: -1200000, cost: 22 }),
    ],
    quiz: [
      quiz(
        "global-shield",
        "How does origin shielding reduce failure risk?",
        ["It removes the CDN", "It coalesces edge misses through a smaller cache tier", "It stores user passwords", "It disables regional routing"],
        1,
        "A shield raises the effective cache-hit ratio seen by origin and dampens synchronized misses. It can also become a bottleneck if undersized."
      ),
      quiz(
        "global-failover",
        "Why keep the secondary origin warm?",
        ["To increase DNS TTLs", "To avoid cold capacity and untested startup during an incident", "To eliminate replication", "To make all writes synchronous"],
        1,
        "Warm capacity shortens recovery time and continuously validates the failover path, at the cost of idle or underused resources."
      ),
    ],
    lesson:
      "At global scale, protecting the origin matters as much as scaling it. Layered caching, request coalescing, warm failover, and graceful quality reduction keep blast radius bounded.",
    tradeoffs: [
      ["Long cache TTL", "High hit rate and low origin cost", "Slower content correction"],
      ["Warm secondary region", "Fast, credible failover", "Significant steady-state spend"],
      ["Geo routing", "Lower latency and regional isolation", "DNS caching slows traffic movement"],
    ],
  },
];

export const SCENARIO_BY_ID = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));

export const DEFAULT_PROGRESS = {
  version: 1,
  activeScenarioId: "url-shortener",
  xp: 0,
  streak: 0,
  completedScenarios: [],
  scenarios: {},
  lastUpdatedAt: null,
};

function component(id, name, type, cost, description, strengths) {
  return { id, name, type, cost, description, strengths };
}

function event(id, title, description, kind, impact) {
  return { id, title, description, kind, impact };
}

function quiz(id, prompt, options, answer, explanation) {
  return { id, prompt, options, answer, explanation };
}

export function emptyScenarioState() {
  return {
    selectedComponents: [],
    appliedEvents: [],
    answers: {},
    score: 0,
    completed: false,
  };
}

export function evaluateArchitecture(scenario, selectedComponents, appliedEvents = []) {
  const selected = new Set(selectedComponents);
  const missing = scenario.required.filter((id) => !selected.has(id));
  const recommended = scenario.recommended.filter((id) => selected.has(id));
  const discouraged = scenario.discouraged.filter((id) => selected.has(id));
  const spent = scenario.components
    .filter((item) => selected.has(item.id))
    .reduce((sum, item) => sum + item.cost, 0);

  let latency = scenario.baseMetrics.latency;
  let availability = scenario.baseMetrics.availability;
  let throughput = scenario.baseMetrics.throughput;
  let cost = scenario.baseMetrics.cost + spent * 4;

  for (const item of scenario.components.filter((component) => selected.has(component.id))) {
    for (const strength of item.strengths) {
      if (strength === "latency") latency *= 0.78;
      if (strength === "availability") availability += (100 - availability) * 0.42;
      if (strength === "throughput") throughput *= 1.65;
      if (strength === "resilience") availability += (100 - availability) * 0.28;
      if (strength === "durability") availability += (100 - availability) * 0.16;
    }
  }

  for (const eventId of appliedEvents) {
    const incident = scenario.events.find((item) => item.id === eventId);
    if (!incident) continue;
    const mitigation = eventMitigation(scenario, selected, incident.kind);
    latency += (incident.impact.latency ?? 0) * (1 - mitigation);
    availability += (incident.impact.availability ?? 0) * (1 - mitigation);
    throughput += (incident.impact.throughput ?? 0) * (1 - mitigation);
    cost += incident.impact.cost ?? 0;
  }

  latency = Math.max(18, Math.round(latency));
  availability = Math.max(0, Math.min(99.999, availability));
  throughput = Math.max(0, Math.round(throughput));
  cost = Math.max(0, Math.round(cost));

  const architectureScore =
    Math.max(0, 58 - missing.length * 15) +
    Math.min(22, recommended.length * 5) -
    discouraged.length * 8 +
    (spent <= scenario.budget ? 12 : Math.max(0, 12 - (spent - scenario.budget) * 3)) +
    (selected.size > 0 ? 8 : 0);
  const score =
    selected.size === 0
      ? 0
      : Math.max(0, Math.min(100, Math.round(architectureScore)));
  const status =
    missing.length === 0 && score >= 78
      ? "ready"
      : selected.size === 0
        ? "empty"
        : score >= 55
          ? "promising"
          : "at-risk";

  const feedback = [];
  if (missing.length) {
    feedback.push(`Add ${missing.map((id) => componentName(scenario, id)).join(", ")} to cover critical requirements.`);
  } else {
    feedback.push("All critical capabilities are covered. Now pressure-test the design and explain its operating model.");
  }
  if (spent > scenario.budget) {
    feedback.push(`The design uses ${spent - scenario.budget} more budget point${spent - scenario.budget === 1 ? "" : "s"} than the target.`);
  }
  if (discouraged.length) {
    feedback.push(`${discouraged.map((id) => componentName(scenario, id)).join(", ")} works, but adds complexity without matching this workload.`);
  }
  if (recommended.length === scenario.recommended.length && scenario.recommended.length > 0) {
    feedback.push("You included every resilience enhancement. Check whether each one earns its operational cost.");
  }

  return {
    score,
    status,
    spent,
    budget: scenario.budget,
    missing,
    recommended,
    discouraged,
    metrics: {
      latency,
      availability: Number(availability.toFixed(3)),
      throughput,
      cost,
    },
    feedback,
  };
}

function eventMitigation(scenario, selected, kind) {
  const mitigationByKind = {
    traffic: ["lb", "autoscale", "cdn", "cache", "queue", "shield", "adaptive"],
    failure: ["replica", "secondary-origin", "geo-dns", "observability", "dlq"],
    cache: ["shield", "kv", "object-store", "autoscale"],
    queue: ["dlq", "workers", "state", "observability"],
    data: ["replica", "state", "kv", "observability"],
    deploy: ["lb", "observability", "autoscale"],
  };
  const candidates = mitigationByKind[kind] ?? [];
  const matches = candidates.filter(
    (id) => selected.has(id) && scenario.components.some((item) => item.id === id)
  );
  return Math.min(0.82, matches.length * 0.24);
}

function componentName(scenario, id) {
  return scenario.components.find((item) => item.id === id)?.name ?? id;
}

export function publicScenario(scenario) {
  return {
    ...scenario,
    quiz: scenario.quiz.map(({ answer, ...question }) => question),
  };
}
