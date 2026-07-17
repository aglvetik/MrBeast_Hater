import type { DetectionResult } from "../detection/types.js";
import type { ActionExecutionResult } from "../../application/services/actionTypes.js";
import type {
  ActorKind,
  CorrelationStage,
  MessageEventSource,
  ModerationDecision,
  PunishmentType,
  RiskExplanation
} from "../policy/types.js";

export interface IncidentRecord {
  readonly id: string;
  readonly guildId: string;
  readonly messageId: string;
  readonly channelId: string;
  readonly actorId: string;
  readonly actorKind: ActorKind;
  readonly eventSource: MessageEventSource;
  readonly messageSignatureHash: string | null;
  readonly ruleId: DetectionResult["ruleId"];
  readonly confidence: DetectionResult["confidence"];
  readonly signals: DetectionResult["signals"];
  readonly mentionedRoleIds: readonly string[];
  readonly mediaSummary: DetectionResult["media"];
  readonly decision: ModerationDecision;
  readonly actionRequested: PunishmentType | "DELETE_ONLY" | "MONITOR" | "ALLOW";
  readonly actionResults: ActionExecutionResult;
  readonly explanation: RiskExplanation;
  readonly correlationStage: CorrelationStage;
  readonly exactFingerprint: string | null;
  readonly structuralFingerprint: string | null;
  readonly protectedMentionClass: string | null;
  readonly processingState: "RESERVED" | "COMPLETED";
  readonly confirmedStrike: boolean;
  readonly dryRun: boolean;
  readonly falsePositive: boolean;
  readonly createdAt: Date;
  readonly sanctionId: string | null;
}
