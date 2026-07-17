# PingGuard

PingGuard is a Discord moderation bot for visual mass-ping raid containment. It is designed for the hard case where a legitimate announcement and the first message of an attack can look nearly identical:

```text
@everyone or @here
+ image / GIF / video / sticker / embed image
+ little or no meaningful text
```

PingGuard now separates containment from punishment.

- A suspicious first event is usually deleted and logged.
- A correlated second event confirms the attack quickly.
- Scoped publishers can post in approved places without gaining unlimited bypass.
- Explicit `IGNORE_ALL`, `MONITOR_ONLY`, `NO_PUNISH`, and `FULL_BYPASS` rules always win.

## Core Behavior

Balanced default:

- First suspicious post from an ordinary actor: `DELETE_ONLY`
- First suspicious post from an in-scope scoped publisher: `ALLOW` plus short-lived observation
- First suspicious post from an objectively new, high-confidence actor: short `QUARANTINE` can apply
- Second correlated event: `ENFORCE`
- Active matching raid session: matching actors can be quarantined or enforced immediately, while still honoring explicit caps

The bot does not automatically trust administrators as publishers. The guild owner can be detected and logged, but is never auto-punished.

## What Is New In This Version

- Weighted risk scoring with explainable signals
- Exact and structural privacy-safe message fingerprints
- Cross-channel correlation and traversal signals
- Temporary guild raid sessions
- Scoped actor policies for users, roles, bots, and webhooks
- Category policies in addition to channel policies
- Per-role mention risk levels
- Batched privacy-safe actor and channel activity tracking
- Update-safe incident deduplication for `messageCreate` and `messageUpdate`
- Final action status persistence after all delete / punishment / log attempts finish

## Commands

Primary command:

```text
/guard
```

Important groups:

- `/guard setup`
- `/guard status`
- `/guard publishers add|remove|list`
- `/guard exceptions add|remove|list`
- `/guard channels set|remove|list`
- `/guard roles add|remove|list|mode|risk`
- `/guard detection preset|first-strike|thresholds`
- `/guard punishment member|bot|escalation`
- `/guard raid status|stop`
- `/guard incidents recent|user|explain|stats`
- `/guard data export|delete`

## Policy Model

Channel and category modes:

- `ENFORCE`
- `DELETE_ONLY`
- `MONITOR_ONLY`
- `NO_PUNISH`
- `IGNORE_ALL`
- `INHERIT`

Actor policies:

- `SCOPED_PUBLISHER`
- `NO_PUNISH`
- `MONITOR_ONLY`
- `FULL_BYPASS`

## Privacy Summary

PingGuard does not permanently store:

- raw message content
- normalized text
- attachment URLs
- downloaded media
- raw link hostnames

PingGuard does store:

- Discord snowflake IDs
- bounded media counts and classes
- protected mention classes
- fingerprint hashes
- action results
- timestamps
- short-lived correlation and raid metadata
- aggregated activity buckets

See [PRIVACY.md](PRIVACY.md) for details.

## Local Development

Use Node.js 24.

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run commands:dev
npm run dev
```

## Validation

Repository validation:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run db:check
npm audit --omit=dev
```

## Deployment Notes

- Enable the Message Content intent.
- Do not enable Guild Members intent only for PingGuard.
- Run the new Drizzle migration before starting the updated bot.
- Re-register slash commands after deploying the updated command schema.
- Review scoped publishers and exceptions after upgrade because the new model is more granular than the older trust-only model.

## Support

- GitHub: `https://github.com/aglvetik/MrBeast_Hater`
- Support server placeholder: `https://discord.gg/your-support-server`
