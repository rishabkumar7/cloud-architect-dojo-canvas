# Contributing

Thanks for improving Cloud Architect Dojo.

- Keep the extension dependency-free unless a dependency clearly improves safety or learning value.
- Add scenarios and components in `data.mjs`; keep explanations concise, accurate, and tradeoff-oriented.
- Preserve loopback-only networking, explicit input validation, durable user-scoped progress, and clean server shutdown.
- Use documented Copilot Canvas theme variables and verify keyboard, narrow-screen, light-theme, and dark-theme behavior.
- Never write debug output to stdout from the extension process. Use the Copilot session logger.

Before submitting a change, reload the extension, inspect its provider status and logs, exercise the affected iframe endpoints, and validate the relevant canvas actions.
