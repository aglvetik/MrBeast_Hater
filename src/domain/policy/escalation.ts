import type { EscalationStep, PunishmentType } from "./types.js";

export interface EscalationDecision {
  readonly punishmentType: PunishmentType;
  readonly durationSeconds: number | null;
}

export function clampTimeoutSeconds(seconds: number): number {
  const bounded = Math.max(60, Math.min(2_419_200, Math.trunc(seconds)));
  return bounded;
}

export function choosePresetEscalation(incidentCountWithinWindow: number): EscalationDecision {
  if (incidentCountWithinWindow >= 4) {
    return { punishmentType: "TIMEOUT", durationSeconds: clampTimeoutSeconds(2_419_200) };
  }

  if (incidentCountWithinWindow === 3) {
    return { punishmentType: "TIMEOUT", durationSeconds: clampTimeoutSeconds(604_800) };
  }

  if (incidentCountWithinWindow === 2) {
    return { punishmentType: "TIMEOUT", durationSeconds: clampTimeoutSeconds(86_400) };
  }

  return { punishmentType: "TIMEOUT", durationSeconds: clampTimeoutSeconds(3_600) };
}

export function chooseCustomEscalation(
  steps: readonly EscalationStep[],
  incidentCountWithinWindow: number
): EscalationDecision | null {
  const enabledSteps = steps
    .filter((step) => step.enabled)
    .sort((left, right) => left.orderIndex - right.orderIndex);

  let selected: EscalationStep | null = null;

  for (const step of enabledSteps) {
    if (incidentCountWithinWindow >= step.thresholdCount) {
      selected = step;
    }
  }

  if (!selected) {
    return null;
  }

  return {
    punishmentType: selected.punishmentType,
    durationSeconds:
      selected.punishmentType === "TIMEOUT" && selected.durationSeconds !== null
        ? clampTimeoutSeconds(selected.durationSeconds)
        : selected.durationSeconds
  };
}
