import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  LOG_PRETTY: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_APPLICATION_ID: z.string().min(1).regex(/^\d+$/),
  DISCORD_DEV_GUILD_ID: z.string().regex(/^\d+$/).optional(),
  DATABASE_URL: z.string().min(1),
  POSTGRES_DB: z.string().default("pingguard"),
  POSTGRES_USER: z.string().default("pingguard"),
  POSTGRES_PASSWORD: z.string().default("change-me"),
  HTTP_HOST: z.string().default("127.0.0.1"),
  HTTP_PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  METRICS_TOKEN: z.string().optional(),
  BASE_URL: z.string().url().default("https://example.com"),
  SUPPORT_SERVER_URL: z.string().url().default("https://discord.gg/your-support-server"),
  GITHUB_REPOSITORY_URL: z.string().url().default("https://github.com/aglvetik/MrBeast_Hater"),
  DEFAULT_LOCALE: z.enum(["en", "ru"]).default("en"),
  RETENTION_GRACE_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 14)
    .default(72)
});

export type Env = z.infer<typeof envSchema>;

export function loadEnvConfig(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "unknown").join(", ");
    throw new Error(`Environment validation failed for: ${fields}`);
  }

  return parsed.data;
}
