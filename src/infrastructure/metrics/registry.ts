import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";

import type { ActionResult } from "../../application/services/actionTypes.js";
import type { DetectionResult } from "../../domain/detection/types.js";
import type { ActorKind, PunishmentType } from "../../domain/policy/types.js";

export interface MetricsService {
  readonly registry: Registry;
  readonly guildsTotal: Gauge;
  recordMessageScanned(): void;
  recordIncident(detection: DetectionResult, actorKind: ActorKind): void;
  recordDelete(result: ActionResult): void;
  recordPunishment(type: PunishmentType, result: ActionResult): void;
  recordActionFailure(action: string, code: string): void;
  recordFalsePositive(): void;
  observeDetectionDuration(seconds: number, detected: boolean): void;
  observeActionDuration(action: string, seconds: number): void;
  recordDatabaseError(operation: string): void;
  recordDiscordError(operation: string): void;
}

export function createMetricsService(): MetricsService {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const messagesScannedTotal = new Counter({
    name: "pingguard_messages_scanned_total",
    help: "Total messages scanned by PingGuard",
    registers: [registry]
  });

  const incidentsTotal = new Counter({
    name: "pingguard_incidents_total",
    help: "Total detected incidents",
    labelNames: ["ruleId", "actorKind"] as const,
    registers: [registry]
  });

  const messagesDeletedTotal = new Counter({
    name: "pingguard_messages_deleted_total",
    help: "Total delete attempts grouped by result",
    labelNames: ["result"] as const,
    registers: [registry]
  });

  const punishmentsTotal = new Counter({
    name: "pingguard_punishments_total",
    help: "Total punishments attempted grouped by type and result",
    labelNames: ["type", "result"] as const,
    registers: [registry]
  });

  const actionFailuresTotal = new Counter({
    name: "pingguard_action_failures_total",
    help: "Total failed actions grouped by action and code",
    labelNames: ["action", "code"] as const,
    registers: [registry]
  });

  const falsePositivesTotal = new Counter({
    name: "pingguard_false_positives_total",
    help: "Total incidents marked as false positive",
    registers: [registry]
  });

  const guildsTotal = new Gauge({
    name: "pingguard_guilds_total",
    help: "Total enabled guilds known to PingGuard",
    registers: [registry]
  });

  const detectionDuration = new Histogram({
    name: "pingguard_detection_duration_seconds",
    help: "Detection pipeline duration in seconds",
    labelNames: ["detected"] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
    registers: [registry]
  });

  const actionDuration = new Histogram({
    name: "pingguard_action_duration_seconds",
    help: "Moderation adapter action duration in seconds",
    labelNames: ["action"] as const,
    buckets: [0.001, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [registry]
  });

  const databaseErrorsTotal = new Counter({
    name: "pingguard_database_errors_total",
    help: "Total database errors grouped by operation",
    labelNames: ["operation"] as const,
    registers: [registry]
  });

  const discordErrorsTotal = new Counter({
    name: "pingguard_discord_errors_total",
    help: "Total Discord API errors grouped by operation",
    labelNames: ["operation"] as const,
    registers: [registry]
  });

  return {
    registry,
    guildsTotal,
    recordMessageScanned(): void {
      messagesScannedTotal.inc();
    },
    recordIncident(detection: DetectionResult, actorKind: ActorKind): void {
      incidentsTotal.inc({
        ruleId: detection.ruleId ?? "none",
        actorKind
      });
    },
    recordDelete(result: ActionResult): void {
      messagesDeletedTotal.inc({ result: result.status });
      if (result.status === "FAILED") {
        actionFailuresTotal.inc({
          action: "delete",
          code: result.code
        });
      }
    },
    recordPunishment(type: PunishmentType, result: ActionResult): void {
      punishmentsTotal.inc({
        type,
        result: result.status
      });
      if (result.status === "FAILED") {
        actionFailuresTotal.inc({
          action: "punishment",
          code: result.code
        });
      }
    },
    recordActionFailure(action: string, code: string): void {
      actionFailuresTotal.inc({ action, code });
    },
    recordFalsePositive(): void {
      falsePositivesTotal.inc();
    },
    observeDetectionDuration(seconds: number, detected: boolean): void {
      detectionDuration.observe({ detected: detected ? "true" : "false" }, seconds);
    },
    observeActionDuration(action: string, seconds: number): void {
      actionDuration.observe({ action }, seconds);
    },
    recordDatabaseError(operation: string): void {
      databaseErrorsTotal.inc({ operation });
    },
    recordDiscordError(operation: string): void {
      discordErrorsTotal.inc({ operation });
    }
  };
}
