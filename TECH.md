# Technical Notes

## Detection rule

The bot only flags a message when all of these are true:

- the message contains `@everyone`, `@here`, or a mass role mention
- the message includes at least one image attachment
- the cleaned message text is short enough to count as no real text

Normal user mentions do not count as mass ping.

## Manual safe channels

`SAFE_CHANNEL_IDS` is checked before spam detection. Messages in those channels are ignored completely:

- no delete
- no timeout
- no incident write
- no Discord moderation log

This is the recommended production-safe option for news and announcement channels.

## Optional automatic safe channels

When `AUTO_SAFE_CHANNELS=true`, the bot estimates how many real non-bot members can send messages in the current channel.

It counts:

- `checkedMembers`: non-bot guild members in cache
- `writers`: non-bot members where `channel.permissionsFor(member).has(SendMessages)` is true

If `writers / checkedMembers` is less than or equal to `AUTO_SAFE_MAX_WRITERS_RATIO`, the channel is treated as safe.

If member fetching fails or is rate-limited, the bot does not crash. It treats the channel as not safe and continues with normal spam detection.

## Shared member cache

`src/memberCache.js` provides a shared guild-member fetch helper for both automatic safe-channel detection and mass-role coverage detection.

It keeps:

- a per-guild last successful fetch timestamp
- a per-guild in-flight fetch promise so concurrent callers reuse the same request
- a per-guild retry-until timestamp when Discord rate-limits the bot

It skips refetching when:

- the member cache is already close to full based on `MEMBER_FETCH_CACHE_FULL_RATIO`
- or the last successful fetch is still within `MEMBER_FETCH_TTL_SECONDS`

This helps avoid repeated `guild.members.fetch()` calls and reduces gateway rate-limit pressure.

## Mass role coverage

Mass role coverage is calculated from non-bot cached members:

```text
members with role / non-bot guild members
```

The bot does not trust `role.members.size` as the source of truth because Discord.js role membership depends on member cache and can undercount.

For non-forced roles:

- the bot uses the shared member cache helper first
- if member fetch is unavailable or rate-limited, the role is not treated as mass

For forced roles:

- `FORCED_MASS_ROLE_IDS` wins immediately
- this is the safest override for important roles and small servers

## Action result tracking

Moderation actions are tracked independently:

- message delete success or failure
- timeout success or failure
- compact error summaries for the Discord log

This keeps the moderation embed accurate. For example, the log can show `deleted + timeout failed` instead of pretending both actions succeeded.

Timeout failures do not stop incident logging or mod-log delivery.

## SQLite incidents

Incidents are stored in SQLite with guild ID, user ID, channel ID, reason, action summary, image count, role details, and timestamp.

The database is local to the bot process and defaults to:

```text
./data/bot.sqlite
```

## Testing

The project includes a small unit-style test suite built with `node:test` and `node:assert/strict`.

The tests use mocked Discord-like objects for guilds, channels, members, roles, and messages. They do not log in a bot, do not require a token, and do not make network calls.

## Known Discord limitations

- Discord timeouts are capped at 28 days.
- A normal bot reacts after `messageCreate`, so the first ping may appear briefly before deletion.
- The goal is to make the first suspicious message the last one.
