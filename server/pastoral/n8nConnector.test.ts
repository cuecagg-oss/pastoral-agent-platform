import { describe, expect, it } from "vitest";
import { assertN8nWorkflowAllowed, getN8nConnectorStatus } from "./n8nConnector";

describe("conector n8n governado", () => {
  it("permanece desativado por padrão e não expõe endereço externo", () => {
    const status = getN8nConnectorStatus();
    expect(status).toEqual({ enabled: false, status: "disabled", allowedWorkflows: [] });
    expect(JSON.stringify(status)).not.toMatch(/http|url|webhook|token|key/i);
  });

  it("recusa identificadores fora da allowlist antes de qualquer execução externa", () => {
    expect(() => assertN8nWorkflowAllowed("https://untrusted.example/webhook")).toThrow("não autorizado");
  });
});
