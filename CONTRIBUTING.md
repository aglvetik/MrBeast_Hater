# Contributing

Use Node.js 24 and npm.

Before opening a pull request, run:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

Keep domain code free of `discord.js` imports. Do not store message content or attachment URLs. Do not add Guild Members Intent.
