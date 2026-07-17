# Changelog

## 2.1.0 - 2026-07-17

- Added the context-aware first-strike versus confirmed-repeat moderation model.
- Added scoped publishers, category policies, actor exceptions, and per-role risk levels.
- Added privacy-safe exact and structural fingerprints.
- Added short-lived correlation storage, raid sessions, and activity buckets.
- Added `messageUpdate` inspection with signature-based deduplication.
- Fixed burst tracking to record only suspicious or observed candidates.
- Fixed custom escalation handling so each step uses its own `windowDays`.
- Fixed false-positive exclusion from future confirmed-incident counting.
- Fixed incident persistence so final action results are stored after all action attempts finish.
- Fixed duplicate moderation ordering by reserving incidents before destructive actions.
- Expanded `/guard` commands for publishers, exceptions, detection controls, raid controls, and incident explanation.

## 2.0.0

- Rebuilt PingGuard as a TypeScript, PostgreSQL, Drizzle, Fastify, Vitest, Docker-ready Discord application.
- Added slash commands, setup components, health endpoints, metrics, retention jobs, and guild-scoped persistence.
- Removed the legacy JavaScript and SQLite runtime.
