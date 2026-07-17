import type { Client } from "discord.js";
import type pino from "pino";

import type { GuildSettingsCache } from "../application/services/settingsCache.js";
import type { ProcessMessageService } from "../application/services/processMessageService.js";
import type { Env } from "../config/env.js";
import type {
  AuditRepository,
  ChannelPolicyRepository,
  EscalationRepository,
  GuildDataRepository,
  GuildSettingsRepository,
  IncidentRepository,
  ProtectedRoleRepository,
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
  readonly channelPolicyRepository: ChannelPolicyRepository;
  readonly trustedActorRepository: TrustedActorRepository;
  readonly escalationRepository: EscalationRepository;
  readonly incidentRepository: IncidentRepository;
  readonly sanctionRepository: SanctionRepository;
  readonly auditRepository: AuditRepository;
  readonly guildDataRepository: GuildDataRepository;
  readonly processMessageService: ProcessMessageService;
  readonly setupSessions: SetupSessionStore;
}
