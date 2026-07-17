# Security Policy

## Supported Versions

Only the current `2.x` line receives security fixes.

## Reporting

Report vulnerabilities privately to `security@example.com` or through a private GitHub security advisory.

Please include reproduction steps, expected impact, and affected versions. Do not publicly disclose active vulnerabilities before maintainers have had a reasonable opportunity to respond.

## Security Notes

PingGuard validates environment variables at startup, redacts known secret fields in logs, avoids Administrator permission, uses parameterized Drizzle queries, blocks outgoing mass mentions, and never downloads attachments or fetches arbitrary message URLs.
