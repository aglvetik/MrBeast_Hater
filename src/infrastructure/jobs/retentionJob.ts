import type pino from "pino";

import type {
  ActivityRepository,
  GuildDataRepository,
  IncidentRepository
} from "../database/repositories.js";
import type { CorrelationService } from "../../application/services/correlationService.js";
import type { RaidSessionService } from "../../application/services/raidSessionService.js";
import type { Clock } from "../../shared/time/clock.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1_000;

export interface RetentionJobDependencies {
  readonly incidentRepository: IncidentRepository;
  readonly guildDataRepository: GuildDataRepository;
  readonly correlationService: CorrelationService;
  readonly raidSessionService: RaidSessionService;
  readonly activityRepository: ActivityRepository;
  readonly clock: Clock;
  readonly logger: pino.Logger;
}

export interface RetentionJobHandle {
  stop(): void;
  runOnce(): Promise<void>;
}

export function createRetentionJob(deps: RetentionJobDependencies): RetentionJobHandle {
  let timer: NodeJS.Timeout | null = null;

  const runOnce = async (): Promise<void> => {
    const now = deps.clock.now();
    const deletedIncidents = await deps.incidentRepository.deleteExpired(now);
    const deletedCorrelationEvents = await deps.correlationService.deleteExpired(now);
    const deletedRaidSessions = await deps.raidSessionService.deleteExpired(now);
    const deletedActivityBuckets = await deps.activityRepository.deleteExpired(
      new Date(now.getTime() - 180 * 24 * 60 * 60 * 1_000)
    );
    const dueGuilds = await deps.guildDataRepository.listDeletionCandidates(now);

    for (const guildId of dueGuilds) {
      await deps.guildDataRepository.deleteGuildData(guildId);
      deps.logger.info(
        {
          event: "guild_data_deleted",
          guildId
        },
        "Deleted expired guild data"
      );
    }

    deps.logger.info(
      {
        event: "retention_job_completed",
        deletedIncidents,
        deletedCorrelationEvents,
        deletedRaidSessions,
        deletedActivityBuckets,
        deletedGuilds: dueGuilds.length
      },
      "Retention job finished"
    );
  };

  timer = setInterval(() => {
    void runOnce().catch((error: unknown) => {
      deps.logger.error(
        {
          event: "retention_job_failed",
          error: error instanceof Error ? error.message : "Unknown retention job error"
        },
        "Retention job failed"
      );
    });
  }, ONE_DAY_MS);
  timer.unref();

  return {
    stop(): void {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    runOnce
  };
}
