export interface ActionResult {
  readonly status: "SUCCESS" | "FAILED" | "SKIPPED";
  readonly code: string;
  readonly message: string;
}

export interface ActionExecutionResult {
  readonly delete: ActionResult;
  readonly punishment: ActionResult;
  readonly persistence: ActionResult;
  readonly modLog: ActionResult;
}
