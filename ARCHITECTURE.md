# Architecture

PingGuard uses a small ports-and-adapters architecture.

Message flow:

1. Discord `messageCreate`.
2. Discord mapper creates an `ObservedMessage` and `ActorContext`.
3. Pure detection code classifies protected mentions, visual media, normalized text, and burst state.
4. Policy code applies guild settings, channel policy, trust policy, actor kind, dry-run, and escalation.
5. Application service coordinates delete, punishment, incident persistence, and mod-log actions independently.
6. Discord adapters execute moderation and presentation work.

The domain layer does not import `discord.js`. PostgreSQL is the source of truth. The in-memory settings cache is a 60-second optimization and can be replaced later for sharding. Actor locks are process-local in v2; future multi-process deployments should replace them with Redis or PostgreSQL advisory locks.

Rejected alternatives:

- SQLite: not suitable for one public multi-guild bot.
- Guild member fetches for role coverage: not available without Guild Members Intent and not reliable for hot-path detection.
- Automatic admin/owner bypass: compromised privileged accounts must still be scanned.
- Web dashboard: intentionally out of scope for v2.
