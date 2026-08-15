import { describe, expect, it, vi } from "vitest";
import { createThanosContext } from "./context";
import { toDomain, toWorkspaceKey, tenantIdFromOrganizationId } from "./contextIdentity";
import { ThanosMultiStepReadOrchestrator } from "./orchestrator";

function createContext(organizationId = 1) {
  return createThanosContext({
    workspaceKey: toWorkspaceKey("pastoral"),
    tenantId: tenantIdFromOrganizationId(organizationId),
    domain: toDomain("pastoral"),
    userId: 2,
    userName: "Pessoa",
    role: "pastor",
    capabilities: ["agent:read"],
    channel: "chat",
    requestId: `multi-${organizationId}`,
  });
}

describe("ThanosMultiStepReadOrchestrator", () => {
  it("encadeia duas leituras com evidência composta, auditoria por etapa e contexto de tenant preservado", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const contexts: string[] = [];
    const generator = vi.fn().mockResolvedValue({ content: "Resumo combinado", provider: "deterministic", model: "rules-v1" });
    const orchestrator = new ThanosMultiStepReadOrchestrator({ record });

    const result = await orchestrator.run({
      context: createContext(11),
      steps: [
        { name: "consultar_celulas", requiredCapability: "agent:read", execute: async context => { contexts.push(context.tenantId); return { summary: "3 células ativas.", data: { total: 3 } }; } },
        { name: "consultar_presenca", requiredCapability: "agent:read", execute: async context => { contexts.push(context.tenantId); return { summary: "27 presenças.", data: { total: 27 } }; } },
      ],
      system: "Sistema",
      user: "Mensagem",
      generator: { generate: generator },
    });

    expect(result).toMatchObject({ content: "Resumo combinado", tools: ["consultar_celulas", "consultar_presenca"], requestId: "multi-11", fallback: false });
    expect(result.evidence).toEqual({
      summary: "3 células ativas. 27 presenças.",
      data: { steps: [{ tool: "consultar_celulas", data: { total: 3 } }, { tool: "consultar_presenca", data: { total: 27 } }] },
    });
    expect(contexts).toEqual(["org:11", "org:11"]);
    expect(generator).toHaveBeenCalledWith(expect.objectContaining({ evidence: result.evidence, context: expect.objectContaining({ tenantId: "org:11" }) }));
    expect(record).toHaveBeenNthCalledWith(1, expect.objectContaining({ action: "thanos.read.step", step: 1, tool: "consultar_celulas", result: "step_completed" }));
    expect(record).toHaveBeenNthCalledWith(2, expect.objectContaining({ action: "thanos.read.step", step: 2, tool: "consultar_presenca", result: "step_completed" }));
    expect(record).toHaveBeenNthCalledWith(3, expect.objectContaining({ action: "thanos.read", result: "multistep_response_generated" }));
  });

  it("interrompe após falha intermediária, audita a etapa e retorna fallback determinístico com evidência concluída", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const generator = vi.fn();
    const orchestrator = new ThanosMultiStepReadOrchestrator({ record });

    const result = await orchestrator.run({
      context: createContext(),
      steps: [
        { name: "consultar_celulas", requiredCapability: "agent:read", execute: async () => ({ summary: "3 células ativas.", data: { total: 3 } }) },
        { name: "consultar_presenca", requiredCapability: "agent:read", execute: async () => { throw new Error("falha interna não exposta"); } },
      ],
      system: "Sistema",
      user: "Mensagem",
      generator: { generate: generator },
    });

    expect(result).toMatchObject({ provider: "deterministic", model: "thanos-multistep-fallback-v1", fallback: true });
    expect(result.content).toBe("3 células ativas. Não foi possível concluir todas as consultas solicitadas no momento.");
    expect(result.evidence).toEqual({ summary: "3 células ativas.", data: { steps: [{ tool: "consultar_celulas", data: { total: 3 } }] } });
    expect(generator).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: "thanos.read.step.failed", step: 2, tool: "consultar_presenca", result: "tool_execution_failed", durationMs: expect.any(Number) }));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: "thanos.read.failed", result: "multistep_partial_fallback" }));
  });

  it("audita duração normalizada e contexto sanitizado quando a capability da etapa é negada", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const timestamps = [20, 10];
    const orchestrator = new ThanosMultiStepReadOrchestrator({ record }, () => timestamps.shift() ?? 10);
    const privatePrompt = "relatório privado da pessoa confidencial";
    const deniedContext = createThanosContext({
      workspaceKey: toWorkspaceKey("pastoral"),
      tenantId: tenantIdFromOrganizationId(8),
      domain: toDomain("pastoral"),
      userId: 2,
      userName: "Pessoa",
      role: "pastor",
      capabilities: [],
      channel: "chat",
      requestId: "multi-denied-8",
    });
    const execute = vi.fn();

    await expect(orchestrator.run({
      context: deniedContext,
      steps: [
        { name: "consultar_relatorios", requiredCapability: "agent:read", execute },
        { name: "consultar_presenca", requiredCapability: "agent:read", execute },
      ],
      system: "Sistema",
      user: privatePrompt,
      generator: { generate: async () => ({ content: "Resposta", provider: "deterministic", model: "rules-v1" }) },
    })).rejects.toThrow("Capability não autorizada");

    const deniedEvent = record.mock.calls.map(([event]) => event).find(event => event.action === "thanos.read.denied");
    expect(deniedEvent).toEqual(expect.objectContaining({
      status: "denied",
      tool: "consultar_relatorios",
      step: 1,
      durationMs: 0,
      context: expect.objectContaining({ requestId: "multi-denied-8", tenantId: "org:8", workspaceKey: "pastoral", domain: "pastoral" }),
    }));
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(deniedEvent)).not.toContain(privatePrompt);
  });

  it("registra duração não negativa e requestId comum em cada etapa de um plano de três leituras", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const timestamps = [10, 5, 20, 45, 60, 90];
    const orchestrator = new ThanosMultiStepReadOrchestrator({ record }, () => timestamps.shift() ?? 90);

    await orchestrator.run({
      context: createContext(7),
      steps: [
        { name: "consultar_celulas", requiredCapability: "agent:read", execute: async () => ({ summary: "Células.", data: {} }) },
        { name: "consultar_presenca", requiredCapability: "agent:read", execute: async () => ({ summary: "Presença.", data: {} }) },
        { name: "consultar_relatorios", requiredCapability: "agent:read", execute: async () => ({ summary: "Relatórios.", data: {} }) },
      ],
      system: "Sistema",
      user: "Mensagem",
      generator: { generate: async () => ({ content: "Resumo", provider: "deterministic", model: "rules-v1" }) },
    });

    const stepEvents = record.mock.calls.map(([event]) => event).filter(event => event.action === "thanos.read.step");
    expect(stepEvents).toEqual([
      expect.objectContaining({ tool: "consultar_celulas", step: 1, durationMs: 0, context: expect.objectContaining({ requestId: "multi-7" }) }),
      expect.objectContaining({ tool: "consultar_presenca", step: 2, durationMs: 25, context: expect.objectContaining({ requestId: "multi-7" }) }),
      expect.objectContaining({ tool: "consultar_relatorios", step: 3, durationMs: 30, context: expect.objectContaining({ requestId: "multi-7" }) }),
    ]);
    expect(stepEvents.every(event => event.durationMs >= 0)).toBe(true);
  });

  it("rejeita planos fora do limite explícito do piloto", async () => {
    const orchestrator = new ThanosMultiStepReadOrchestrator({ record: vi.fn().mockResolvedValue(undefined) });
    await expect(orchestrator.run({
      context: createContext(),
      steps: [{ name: "consultar_celulas", requiredCapability: "agent:read", execute: async () => ({ summary: "Resumo", data: {} }) }],
      system: "Sistema",
      user: "Mensagem",
      generator: { generate: async () => ({ content: "Resposta", provider: "deterministic", model: "rules-v1" }) },
    })).rejects.toThrow("entre duas e três ferramentas");
  });
});
