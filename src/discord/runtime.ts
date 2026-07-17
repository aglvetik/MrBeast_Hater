import type { Client } from "discord.js";
import type pino from "pino";

import type { ActivityTracker } from "../application/services/activityTracker.js";
import type { CorrelationService } from "../application/services/correlationService.js";
import type { GuildSettingsCache } from "../application/services/settingsCache.js";
import type { ProcessMessageService } from "../application/services/processMessageService.js";
import type { RaidSessionService } from "../application/services/raidSessionService.js";
import type { Env } from "../config/env.js";
import type {
  ActivityRepository,
  ActorPolicyRepository,
  AuditRepository,
  CategoryPolicyRepository,
  ChannelPolicyRepository,
  EscalationRepository,
  GuildDataRepository,
  GuildSettingsRepository,
  IncidentRepository,
  ProtectedRoleRepository,
  RaidSessionRepository,
  RecentDetectionEventRepository,
  RoleRiskProfileRepository,
  SanctionRepository,
  TrustedActorRepository
} from "../infrastructure/database/repositories.js";
import type { ReadinessState } from "../infrastructure/health/readiness.js";
import type { MetricsService } from "../infrastructure/metrics/registry.js";
import type { Clock } from "../shared/time/clock.js";
import type { SetupSessionStore } from "./components/setupStore.js";

export interface DiscordAppContext {
  readonly env: Env;
  readonly logger: pino.Logger;
  readonly client: Client;
  readonly readiness: ReadinessState;
  readonly metrics: MetricsService;
  readonly clock: Clock;
  readonly settingsRepository: GuildSettingsRepository;
  readonly settingsCache: GuildSettingsCache;
  readonly protectedRoleRepository: ProtectedRoleRepository;
  readonly roleRiskProfileRepository: RoleRiskProfileRepository;
  readonly channelPolicyRepository: ChannelPolicyRepository;
  readonly categoryPolicyRepository: CategoryPolicyRepository;
  readonly trustedActorRepository: TrustedActorRepository;
  readonly actorPolicyRepository: ActorPolicyRepository;
  readonly escalationRepository: EscalationRepository;
  readonly incidentRepository: IncidentRepository;
  readonly sanctionRepository: SanctionRepository;
  readonly auditRepository: AuditRepository;
  readonly guildDataRepository: GuildDataRepository;
  readonly recentDetectionEventRepository: RecentDetectionEventRepository;
  readonly raidSessionRepository: RaidSessionRepository;
  readonly activityRepository: ActivityRepository;
  readonly correlationService: CorrelationService;
  readonly raidSessionService: RaidSessionService;
  readonly activityTracker: ActivityTracker;
  readonly processMessageService: ProcessMessageService;
  readonly setupSessions: SetupSessionStore;
}
