import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { FastifyInstance } from "fastify";

import { InMemoryActorLock } from "./application/locks/inMemoryActorLock.js";
import { BurstTracker } from "./application/services/burstTracker.js";
import { ProcessMessageService } from "./application/services/processMessageService.js";
import { GuildSettingsCache } from "./application/services/settingsCache.js";
import { loadEnvConfig } from "./config/env.js";
import { createDiscordClient } from "./discord/client.js";
import { SetupSessionStore } from "./discord/components/setupStore.js";
import { registerDiscordEventHandlers } from "./discord/events/register.js";
import type { DiscordAppContext } from "./discord/runtime.js";
import { createDatabaseClient, type DatabaseClient } from "./infrastructure/database/client.js";
import {
  AuditRepository,
  ChannelPolicyRepository,
  EscalationRepository,
  GuildDataRepository,
  GuildSettingsRepository,
  IncidentRepository,
  ProtectedRoleRepository,
  SanctionRepository,
  TrustedActorRepository
} from "./infrastructure/database/repositories.js";
import { createHealthServer } from "./infrastructure/health/server.js";
import { ReadinessState } from "./infrastructure/health/readiness.js";
import { createRetentionJob, type RetentionJobHandle } from "./infrastructure/jobs/retentionJob.js";
import { createLogger } from "./infrastructure/logging/logger.js";
import { createMetricsService } from "./infrastructure/metrics/registry.js";
import { systemClock } from "./shared/time/clock.js";

export interface PingGuardRuntime {
  readonly context: DiscordAppContext;
  start(): Promise<void>;
  stop(): Promise<void>;
}

async function applyMigrations(database: DatabaseClient): Promise<void> {
  await migrate(database.db, { migrationsFolder: "drizzle" });
}

export async function bootstrap(): Promise<PingGuardRuntime> {
  const env = loadEnvConfig();
  const logger = createLogger(env);
  const database = createDatabaseClient(env);
  const metrics = createMetricsService();
  const readiness = new ReadinessState();

  await applyMigrations(database);
  readiness.markMigrationsCurrent(true);
  readiness.markDatabaseReady(true);

  const settingsRepository = new GuildSettingsRepository(database);
  const settingsCache = new GuildSettingsCache(settingsRepository);
  const protectedRoleRepository = new ProtectedRoleRepository(database);
  const channelPolicyRepository = new ChannelPolicyRepository(database);
  const trustedActorRepository = new TrustedActorRepository(database);
  const escalationRepository = new EscalationRepository(database);
  const incidentRepository = new IncidentRepository(database);
  const sanctionRepository = new SanctionRepository(database);
  const auditRepository = new AuditRepository(database);
  const guildDataRepository = new GuildDataRepository(database);

  const context: DiscordAppContext = {
    env,
    logger,
    client: createDiscordClient(),
    readiness,
    metrics,
    clock: systemClock,
    settingsRepository,
    settingsCache,
    protectedRoleRepository,
    channelPolicyRepository,
    trustedActorRepository,
    escalationRepository,
    incidentRepository,
    sanctionRepository,
    auditRepository,
    guildDataRepository,
    processMessageService: new ProcessMessageService({
      settingsRepository,
      settingsCache,
      protectedRoleRepository,
      channelPolicyRepository,
      trustedActorRepository,
      escalationRepository,
      incidentRepository,
      sanctionRepository,
      auditRepository,
      actorLock: new InMemoryActorLock(),
      burstTracker: new BurstTracker(),
      clock: systemClock
    }),
    setupSessions: new SetupSessionStore()
  };

  registerDiscordEventHandlers(context);

  const healthServer = createHealthServer({
    env,
    database,
    metrics,
    readiness
  });

  const retentionJob = createRetentionJob({
    incidentRepository,
    guildDataRepository,
    clock: systemClock,
    logger
  });

  return createRuntime(context, database, healthServer, retentionJob);
}

function createRuntime(
  context: DiscordAppContext,
  database: DatabaseClient,
  healthServer: FastifyInstance,
  retentionJob: RetentionJobHandle
): PingGuardRuntime {
  let started = false;

  return {
    context,
    async start(): Promise<void> {
      if (started) {
        return;
      }

      await healthServer.listen({
        host: context.env.HTTP_HOST,
        port: context.env.HTTP_PORT
      });

      await retentionJob.runOnce().catch((error: unknown) => {
        context.metrics.recordDatabaseError("retention_job");
        context.logger.warn(
          {
            event: "retention_job_start_failed",
            error: error instanceof Error ? error.message : "Unknown retention error"
          },
          "Initial retention job run failed"
        );
      });

      await context.client.login(context.env.DISCORD_TOKEN);
      started = true;

      context.logger.info(
        {
          event: "runtime_started",
          host: context.env.HTTP_HOST,
          port: context.env.HTTP_PORT
        },
        "PingGuard runtime started"
      );
    },
    async stop(): Promise<void> {
      retentionJob.stop();
      context.readiness.markDiscordReady(false);

      if (started) {
        await context.client.destroy();
      }

      await healthServer.close();
      await database.close();
      started = false;
    }
  };
}
