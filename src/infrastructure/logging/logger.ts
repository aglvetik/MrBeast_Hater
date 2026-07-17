import pino from "pino";

import type { Env } from "../../config/env.js";

export function createLogger(env: Env): pino.Logger {
  const options: pino.LoggerOptions = {
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "token",
        "databaseUrl",
        "authorization",
        "headers.authorization",
        "headers.cookie",
        "cookies",
        "interaction.token"
      ],
      censor: "[REDACTED]"
    }
  };

  if (env.NODE_ENV === "development" && env.LOG_PRETTY) {
    options.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        singleLine: true,
        translateTime: "SYS:standard"
      }
    };
  }

  return pino(options);
}
