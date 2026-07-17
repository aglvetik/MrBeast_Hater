# PingGuard

PingGuard is a free public Discord bot for protecting servers from visual mass-ping spam. It looks for messages that combine a protected ping such as `@everyone`, `@here`, or a configured role mention with images, GIFs, videos, stickers, or embed images and very little meaningful text.

Threat example: a compromised account posts a mass ping with a giveaway image and no real explanation. PingGuard can delete the message, apply the configured punishment, save an incident, and send a safe moderation log.

## Features

- One multi-guild Discord application configured with `/guard`.
- Guided setup wizard using Discord components.
- Per-guild PostgreSQL settings, protected roles, channel policies, trust policies, incidents, sanctions, escalation steps, and audit events.
- Deterministic detection only: no AI, OCR, URL fetching, or attachment downloads.
- Scans normal users, other bots, and webhooks; ignores only PingGuard's own messages.
- No automatic owner or administrator bypass for detection.
- English and Russian runtime text.
- Docker Compose deployment with PostgreSQL and Caddy.

## Non-goals

- No web dashboard in v2.
- No Redis, sharding manager, OCR, AI classifier, or frontend framework.
- No automatic safe announcement-channel detection.
- No production SQLite path.

## Invite

Create an OAuth2 invite in the Discord Developer Portal for your application ID. Use the placeholder site link until a production application ID is chosen:

```text
https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot%20applications.commands&permissions=1099780062208
```

## Required Permissions

PingGuard does not require Administrator. Grant only what your policy needs:

- View Channels
- Read Message History
- Send Messages and Embed Links in the moderation log channel
- Manage Messages
- Moderate Members for timeouts
- Kick Members or Ban Members only if explicitly configured

## Gateway Intents

Enable Message Content Intent in the Discord Developer Portal. Do not enable or require Server Members Intent.

The runtime uses only:

- Guilds
- Guild Messages
- Message Content

## Local Development

Use Node.js 24 LTS.

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run commands:dev
npm run dev
```

Development command registration uses `DISCORD_DEV_GUILD_ID`. Global command registration is separate:

```bash
npm run commands:global
```

## Tests

```bash
npm test
npm run test:coverage
```

The unit and application tests use mocked adapters and do not log in to Discord. They do not need a real bot token.

## Docker Deployment

```bash
cp .env.example .env
docker compose up -d --build
```

PostgreSQL is on the internal Compose network only. Caddy serves the static site and proxies health endpoints.

Backups:

```bash
./scripts/backup-postgres.sh
./scripts/restore-postgres.sh backups/pingguard-YYYYmmdd-HHMMSS.sql
```

## Privacy Summary

PingGuard stores Discord IDs and incident metadata only. It does not store raw message content, normalized text, usernames, display names, avatars, attachment URLs, embed URLs, images, videos, GIFs, stickers, or full member lists.

Guild owners can use `/guard data export` and `/guard data delete`.

## Troubleshooting

- Bot does nothing: check Message Content Intent, token, command registration, and guild permissions.
- Message deletes but punishment fails: check role hierarchy and the specific timeout/kick/ban permission.
- No logs appear: set a log channel with `/guard setup` or `/guard status`, then check channel Send Messages and Embed Links permissions.
- Docker health is not ready: check PostgreSQL connectivity, migrations, and Discord login.

## Screenshots

Screenshots are intentionally placeholders until a production application ID and support server are available:

- Setup wizard
- Incident mod-log embed
- Status command

## Migration Note

v2 replaces the JavaScript/SQLite prototype. The old `.env` keys, safe-channel bypass lists, mass-role coverage calculation, and `src/index.js` entrypoint are not part of the production TypeScript runtime.

## Support

- Support server placeholder: `https://discord.gg/your-support-server`
- GitHub: `https://github.com/aglvetik/MrBeast_Hater`

## License

MIT. See [LICENSE](LICENSE).
