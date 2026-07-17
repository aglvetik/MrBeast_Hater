# Technical Notes

PingGuard v2 is a TypeScript, PostgreSQL, and Discord.js v14 rebuild of the earlier prototype.

## Architecture

The code follows a small ports-and-adapters structure:

```text
Discord messageCreate
-> Discord message mapper
-> pure detection engine
-> policy engine
-> application action service
-> Discord moderation adapter
-> incident repository
-> mod-log presenter
```

Domain detection and policy modules do not import `discord.js`. PostgreSQL is the source of truth, with a short in-memory settings cache used only as an optimization.

## Detection

The detector is deterministic. It classifies:

- `@everyone`, `@here`, and protected role mentions;
- image, GIF, video, embed image, embed thumbnail, and sticker counts;
- normalized low-information text;
- short burst windows.

It never downloads attachments, fetches message URLs, stores raw content, or stores attachment URLs.

## Role Detection

v2 intentionally does not calculate role coverage from guild member lists. The runtime does not request Guild Members Intent and does not fetch full guild member lists.

Role detection modes are:

- `MANUAL`: `@everyone`, `@here`, and roles configured in `protected_roles`.
- `ALL_ROLES`: any actual role mention, with a false-positive warning.

## Channel And Trust Policies

Channel policies are explicit per guild and channel:

- `ENFORCE`: detect, delete, punish, log.
- `DELETE_ONLY`: detect, delete, log.
- `MONITOR`: detect and log only.
- `DISABLED`: ignore that channel.

Trust policies are explicit database rows for roles, bot IDs, or webhook IDs:

- `NO_PUNISH`
- `MONITOR`
- `ALLOW`

There is no automatic safe announcement-channel bypass in v2.

## Database

Drizzle migrations live in `drizzle/`. Guild-owned repositories require `guildId` and store Discord snowflakes as `varchar(20)`.

The schema includes:

- `guild_settings`
- `protected_roles`
- `channel_policies`
- `trusted_actors`
- `incidents`
- `sanctions`
- `escalation_steps`
- `config_audit_events`

The incident table has a unique `(guild_id, message_id)` constraint. Raw message content, normalized text, usernames, avatars, attachment URLs, embed URLs, images, and full member lists are not schema fields.

## Concurrency And Idempotency

The application service uses a process-local lock keyed by `guildId:actorId`, a unique incident constraint, and a per-guild sanction cooldown. This is suitable for one VPS process. Future sharding should replace the process-local lock with PostgreSQL advisory locks or Redis without changing domain logic.

Setup completion and full guild deletion use guild-scoped database transactions.

## Health And Metrics

Fastify serves:

- `GET /health/live`
- `GET /health/ready`
- `GET /metrics`

Metrics avoid guild, channel, user, and message ID labels. `/metrics` should use `METRICS_TOKEN` unless bound to an internal interface.

## Testing

Vitest is the active test runner. Tests use fake adapters and mocked inputs, not a live Discord client. Property tests use `fast-check` for normalization behavior.

Primary commands:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

## Docker

The Dockerfile is multi-stage, pinned to Node.js 24, runs production dependencies only in the runtime image, and uses a non-root user. Compose runs `bot`, `postgres`, and `caddy`; PostgreSQL has no public host port by default.

## Known Limitations

- Integration tests that require a real PostgreSQL instance are intended for CI/service-container environments.
- The first visible Discord ping can appear briefly because bots moderate after `messageCreate`.
- Sharding is designed for later but not enabled in v2.
