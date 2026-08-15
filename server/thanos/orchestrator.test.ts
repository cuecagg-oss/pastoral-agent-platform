import { describe, expect, it, vi } from "vitest";
import { createThanosContext } from "./context";
import { toDomain, toWorkspaceKey, tenantIdFromOrganizationId } from "./contextIdentity";
import { ThanosReadOrchestrator } from "./orchestrator";

function createContext(capabilities: readonly string[] = ["agent:read"]) {
  return createThanosContext({
    workspaceKey: toWorkspaceKey("pastoral"),
    tenantId: tenantIdFromOrganizationId(1),
    domain: toDomain("pastoral"),
    userId: 2,
    userName: "Pessoa",
    role: "pastor",
    capabilities,
    channel: "chat",
    requestId: "request-1",
  });
}

describe("ThanosReadOrchestrator", () => {
  it("executa uma etapa autorizada e registra apenas metadados sanitizados", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const orchestrator = new ThanosReadOrchestrator({ record });
    const result = await orchestrator.run({
      context: createContext(),
      tool: { name: "consulta", requiredCapability: "agent:read", execute: async () => ({ summary: "Resumo", data: { total: 2 } }) },
      system: "Sistema",
      user: "Mensagem",
      generator: { generate: async () => ({ content: "Resposta", provider: "deterministic", model: "rules-v1" }) },
    });

    expect(result).toMatchObject({ content: "Resposta", tool: "consulta", requestId: "request-1" });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: "thanos.read", result: "response_generated", tool: "consulta" }));
    expect(record.mock.calls[0][0]).not.toHaveProperty("user");
    expect(record.mock.calls[0][0]).not.toHaveProperty("evidence");
  });

  it("nega capability antes da ferramenta e audita a decisão", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const execute = vi.fn();
    const orchestrator = new ThanosReadOrchestrator({ record });

    await expect(orchestrator.run({
      context: createContext([]),
      tool: { name: "consulta", requiredCapability: "agent:read", execute },
      system: "Sistema",
      user: "Mensagem",
      generator: { generate: async () => ({ content: "Resposta", provider: "deterministic", model: "rules-v1" }) },
    })).rejects.toThrow("Capability não autorizada");

    expect(execute).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: "thanos.read.denied", status: "denied" }));
  });
});
