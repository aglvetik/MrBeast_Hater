# Agent Guide

- Keep domain, application, Discord, and infrastructure boundaries separate.
- Domain and policy code must not import `discord.js`.
- Never store raw message content, normalized content, attachment URLs, usernames, avatars, or full member lists.
- Do not add Guild Members Intent or Administrator permission.
- Every guild-owned repository method must require `guildId`.
- Run format, lint, typecheck, coverage, build, and relevant Docker checks before reporting completion.
- Generated Drizzle migrations live in `drizzle/`.
- Update docs when changing configuration, commands, data storage, privacy behavior, or deployment.
