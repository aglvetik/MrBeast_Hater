# Architecture

PingGuard uses a small ports-and-adapters structure with the Discord API isolated at the edge.

## Hot Path

```text
messageCreate / messageUpdate
-> Discord mapper
-> base visual mass-ping analyzer
-> fingerprinting
-> correlation lookup
-> activity profile lookup
-> weighted risk scoring
-> action caps and policy precedence
-> incident reservation
-> delete / punish / mod-log adapters
-> incident finalization
-> short-lived correlation event + raid session update
```

## Layers

- `src/domain/detection/*`
  Pure scoring, fingerprints, correlation interpretation, text/media normalization.
- `src/domain/policy/*`
  Policy precedence, actor/channel/category caps, escalation decisions.
- `src/application/services/*`
  Orchestration, idempotency, activity batching, correlation, raid sessions.
- `src/discord/*`
  Mapping, slash commands, component handlers, Discord moderation adapter, presentation.
- `src/infrastructure/database/*`
  Drizzle schema, repositories, migrations, retention cleanup.

## Key Design Decisions

- Detection is separate from punishment.
- A suspicious first event can be contained without a long strike.
- Correlation is short-lived and privacy-safe.
- Explicit bypass and no-punish rules are configured, never inferred from Discord admin status.
- False positives are excluded from future escalation counts.

## Current Single-Process Assumptions

- actor lock is process-local
- activity batching is process-local
- correlation and raid persistence are PostgreSQL-backed, but locking is not yet distributed

Before multi-process or sharded deployment, replace the local actor lock and local batching coordination with a distributed mechanism.
