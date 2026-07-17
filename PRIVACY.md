# Privacy Policy

PingGuard stores only the minimum metadata needed to operate the moderation system.

## Stored

- guild, channel, category, role, user, bot, webhook, and message IDs
- detection rule IDs
- protected mention class
- media counts and bounded media classes
- fingerprint hashes
- action results
- timestamps
- short-lived correlation events
- temporary raid-session metadata
- aggregated actor and channel activity buckets

## Not Stored

- raw message content
- full normalized text
- attachment URLs
- downloaded media
- raw link hostnames
- usernames, nicknames, avatars, or bios
- full member lists

## Retention

- incident retention follows each guild's `retentionDays`
- correlation events expire automatically
- raid sessions expire automatically
- activity buckets are cleaned up by retention jobs

Guild owners can export or delete guild-scoped data with `/guard data export` and `/guard data delete`.
