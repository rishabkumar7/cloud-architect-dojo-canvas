# Cloud Architect Dojo

**Train your architecture instincts.** Cloud Architect Dojo is an interactive GitHub Copilot Canvas extension for learning cloud computing and system design by building architectures, pressure-testing them, and explaining the tradeoffs.

Instead of presenting another static diagram or quiz, the dojo puts learners in a decision loop:

1. Pick a mission with explicit scale, reliability, and cost goals.
2. Assemble an architecture from workload-specific components.
3. Apply traffic spikes and failure events.
4. Watch latency, availability, throughput, and cost respond.
5. Complete concept checkpoints with explanations—not just a grade.

## Learning missions

| Mission | Level | Focus |
|---|---|---|
| **Tiny Links, Big Traffic** | Starter | Read-heavy services, caching, key-value storage, async analytics |
| **Always-On Launchpad** | Intermediate | Multi-AZ design, health checks, replication, stateless compute |
| **Order Stream Command** | Advanced | Queues, idempotency, sagas, dead-letter handling |
| **Planet-Scale Premiere** | Expert | CDNs, origin shielding, multi-region failover, global delivery |

Each mission includes a component budget, live topology, dynamic metrics, three incident simulations, explicit architecture feedback, a tradeoff map, and two knowledge checks. Progress, XP, completion, and scenario state persist across app and extension restarts.

## Highlights

- **A complete learning dashboard** with mission progress, scores, XP, and a guided path.
- **Interactive architecture workspace** with accessible click-to-add components and a layered visual topology.
- **Dynamic incident simulations** for viral traffic, cold caches, zone and region failures, poison messages, payment ambiguity, origin pressure, and more.
- **Tradeoff-first teaching** that explains the benefit and operational cost of each design choice.
- **Durable user-level progress** stored under the Copilot home directory rather than transient canvas instance IDs.
- **Agent-facing canvas actions** for inspecting state, selecting scenarios, editing architectures, applying incidents, and resetting progress.
- **Responsive and accessible UI** with keyboard controls, reduced-motion support, semantic HTML, visible focus, and documented Copilot Canvas theme variables.
- **Dependency-free runtime** using Node.js built-ins and the Copilot SDK supplied by the host.

## Install and use

This is a project-scoped extension. Open this repository in the GitHub Copilot app, allow repository extensions, and reload extensions if the project was already open. Copilot discovers:

```text
.github/extensions/cloud-architect-dojo/extension.mjs
```

Ask Copilot to open **Cloud Architect Dojo**, or open the `cloud-architect-dojo` canvas from a compatible canvas picker. The canvas optionally accepts:

```json
{
  "scenarioId": "url-shortener",
  "view": "dashboard"
}
```

Valid scenario IDs are `url-shortener`, `ha-web-app`, `event-orders`, and `global-media`.

## Agent-facing actions

| Action | Purpose |
|---|---|
| `get_state` | Inspect progress, active mission, architecture, and metrics |
| `list_scenarios` | List missions, concepts, scores, and completion |
| `set_scenario` | Select and rehydrate a mission |
| `set_component` | Add or remove one architecture component |
| `apply_event` | Run a workload or failure simulation |
| `answer_checkpoint` | Answer a concept check and return its explanation |
| `reset_progress` | Reset one mission or all dojo progress |

The iframe communicates only with a per-instance HTTP server bound to `127.0.0.1` on an ephemeral port. JSON endpoints enforce input and body-size validation, return explicit errors, and broadcast state changes through Server-Sent Events. Closing the canvas closes its server and active event streams.

## Architecture

```text
.github/extensions/cloud-architect-dojo/
├── extension.mjs          # Copilot SDK canvas declaration and agent actions
├── canvas-server.mjs      # Loopback HTTP API, SSE, and asset delivery
├── dojo-service.mjs       # Shared commands used by the iframe and agent
├── data.mjs               # Missions, components, events, quizzes, scoring
├── state-store.mjs        # Atomic durable progress persistence
├── copilot-extension.json # Share/install manifest
├── scripts/
│   └── smoke-test.mjs     # Dependency-free HTTP and persistence checks
└── assets/
    ├── index.html         # Accessible iframe shell
    ├── app.js             # Interactive client and rendering
    └── styles.css         # Responsive themed visual system
```

The extension stores progress at:

```text
$COPILOT_HOME/extensions/cloud-architect-dojo/artifacts/progress.json
```

When `COPILOT_HOME` is unset, it uses `~/.copilot`.

## Development

The extension intentionally has no `package.json` or local SDK installation. The Copilot runtime supplies `@github/copilot-sdk`.

Run the dependency-free validation:

```bash
for file in .github/extensions/cloud-architect-dojo/*.mjs \
  .github/extensions/cloud-architect-dojo/assets/app.js \
  .github/extensions/cloud-architect-dojo/scripts/*.mjs
do
  node --check "$file" || exit 1
done

node .github/extensions/cloud-architect-dojo/scripts/smoke-test.mjs

node --experimental-loader \
  ./.github/extensions/cloud-architect-dojo/scripts/sdk-stub-loader.mjs \
  .github/extensions/cloud-architect-dojo/scripts/extension-contract-test.mjs
```

## Demo and screenshots

For a challenge demo, capture this short flow:

1. Dashboard → show the four-mission progression.
2. Tiny Links → add the load balancer, API, cache, and key-value store.
3. Run **A link goes viral**, then compare the architecture with and without cache/queue protections.
4. Open **Planet-Scale Premiere** → demonstrate how CDN, origin shield, and warm secondary region change the regional-failure result.
5. Answer a checkpoint and return to the dashboard to show persisted XP and completion.

Recommended screenshots: the landing dashboard, a populated live topology with metrics, an applied incident, and the lesson/tradeoff view in both light and dark themes.

## Challenge context

Cloud Architect Dojo was created as a public canvas challenge entry inspired by GitHub's article, [How to build interactive experiences with Canvases](https://github.blog/ai-and-ml/github-copilot/how-to-build-interactive-experiences-with-canvases/). It is an original educational experience designed around the Canvas model: agent-addressable actions for orchestration plus a rich local iframe for direct learner interaction.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). By contributing, you agree that your work is licensed under the [MIT License](LICENSE).
