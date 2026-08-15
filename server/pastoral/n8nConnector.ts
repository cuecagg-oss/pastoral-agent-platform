import { ENV } from "../_core/env";

const declaredN8nWorkflows = ["sync_pastoral_summary"] as const;
export type N8nWorkflowId = (typeof declaredN8nWorkflows)[number];

function enabled(value: string) {
  return ["1", "true", "on", "yes"].includes(value.trim().toLowerCase());
}

function configuredAllowlist(): N8nWorkflowId[] {
  const requested = new Set(ENV.n8nAllowedWorkflows.split(",").map(value => value.trim()).filter(Boolean));
  return declaredN8nWorkflows.filter(workflow => requested.has(workflow));
}

export function getN8nConnectorStatus() {
  const isEnabled = enabled(ENV.n8nEnabled);
  return {
    enabled: isEnabled,
    status: isEnabled ? "prepared" : "disabled",
    allowedWorkflows: isEnabled ? configuredAllowlist() : [],
  } as const;
}

export function assertN8nWorkflowAllowed(workflowId: string): asserts workflowId is N8nWorkflowId {
  const status = getN8nConnectorStatus();
  if (!status.enabled || !status.allowedWorkflows.includes(workflowId as N8nWorkflowId)) {
    throw new Error("Workflow n8n não autorizado.");
  }
}
