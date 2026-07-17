# Technical Notes

## Detection Model

PingGuard now builds two privacy-safe fingerprints:

- exact fingerprint
- structural fingerprint

Inputs include:

- protected mention class
- normalized text hash
- media classes
- role risk level
- link hostname hashes
- visual count

No attachment download or URL fetch is required.

## Risk Model

The weighted score uses named signals such as:

- mention severity
- low-information visual-only structure
- unauthorized scope
- new account / recent join
- low activity after warmup
- quiet or restricted channel context
- exact or structural repeat
- adjacent-channel movement
- coordinated multi-actor match
- active raid-session match

Thresholds map to:

- `ALLOW`
- `OBSERVE`
- `LOG_ONLY`
- `DELETE_ONLY`
- `QUARANTINE`
- `ENFORCE`

Thresholds do not bypass policy caps.

## Policy Precedence

Order of effect:

1. explicit channel or category `IGNORE_ALL`
2. explicit actor `FULL_BYPASS`
3. monitor-only / no-punish caps
4. first-event caps
5. repeat / raid-session escalation

## Persistence

Important tables now include:

- `guild_settings`
- `channel_policies`
- `category_policies`
- `actor_policies`
- `role_risk_profiles`
- `incidents`
- `recent_detection_events`
- `raid_sessions`
- `actor_activity_buckets`
- `channel_activity_buckets`

Incidents are reserved before destructive actions using a message-signature-aware uniqueness model, then finalized with real action results after Discord and persistence work completes.

## Message Updates

`messageUpdate` is processed when detection-relevant fields change. Duplicate update events are deduplicated by event source plus message signature hash.

## Retention

Retention cleanup removes:

- expired incidents according to per-guild retention
- expired correlation events
- expired raid sessions
- old activity buckets
- guild data after deletion grace windows
