import { describe, expect, it, vi } from "vitest";
import { pastoralToolCatalog } from "../../pastoral/toolCatalog";
import { PastoralThanosFacade } from "./thanosFacade";
import type { PastoralRepository, TenantContext } from "../../pastoral/types";

const context: TenantContext = {
  organizationId: 1,
  organizationName: "Igreja Demonstração A",
  userId: 7,
  userName: "Pessoa Teste",
  role: "pastor",
};

function createRepository(): PastoralRepository {
  return {
    queryCells: vi.fn().mockResolvedValue({ tool: "consultar_celulas", summary: "Há 2 células ativas.", data: { total: 2 } }),
    queryReports: vi.fn().mockResolvedValue({ tool: "consultar_relatorios", summary: "Há 1 relatório pendente.", data: { pending: 1 } }),
    queryAttendance: vi.fn().mockResolvedValue({ tool: "consultar_presenca", summary: "A presença foi 18.", data: { total: 18 } }),
    queryVisitors: vi.fn(), queryLeaders: vi.fn(), findVisitor: vi.fn(),
    appendMessage: vi.fn().mockResolvedValue(undefined), writeFollowup: vi.fn(), audit: vi.fn().mockResolvedValue(undefined),
  };
}

describe("PastoralThanosFacade", () => {
  it("mantém a resposta de leitura compatível com o contrato pastoral", async () => {
    const repository = createRepository();
    const facade = new PastoralThanosFacade(
      repository,
      { generate: vi.fn().mockResolvedValue({ content: "Há 2 células ativas.", provider: "deterministic", model: "pastoral-rules-v1" }) },
      async () => pastoralToolCatalog,
    );

    const result = await facade.respondRead({ context, conversationId: 5, message: "Quantas células?", requestId: "compat-1" });

    expect(result).toEqual({
      content: "Há 2 células ativas.", provider: "deterministic", model: "pastoral-rules-v1", tool: "consultar_celulas", requestId: "compat-1", confirmationStatus: "not_required",
    });
    expect(repository.appendMessage).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 5, tool: "consultar_celulas" }));
    expect(repository.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "agent.respond", requestId: "compat-1", result: "response_generated" }));
    expect(repository.queryCells).toHaveBeenCalledTimes(1);
  });

  it("encadeia três leituras autorizadas no mesmo tenant e persiste uma única resposta composta", async () => {
    const repository = createRepository();
    const facade = new PastoralThanosFacade(
      repository,
      { generate: vi.fn().mockResolvedValue({ content: "Resumo composto autorizado.", provider: "deterministic", model: "pastoral-rules-v1" }) },
      async () => pastoralToolCatalog,
    );

    const result = await facade.respondMultiRead({
      context, conversationId: 6, requestId: "multi-3", message: "Resumo de células, presença e relatórios",
      tools: ["consultar_celulas", "consultar_presenca", "consultar_relatorios"],
    });

    expect(result).toMatchObject({ content: "Resumo composto autorizado.", requestId: "multi-3", tool: "consultar_celulas,consultar_presenca,consultar_relatorios" });
    expect(repository.queryCells).toHaveBeenCalledWith(context);
    expect(repository.queryAttendance).toHaveBeenCalledWith(context);
    expect(repository.queryReports).toHaveBeenCalledWith(context);
    expect(repository.appendMessage).toHaveBeenCalledTimes(1);
    expect(repository.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "agent.tool.execute", requestId: "multi-3", tool: "consultar_relatorios" }));
  });

  it("faz fallback composto quando relatórios falha na terceira etapa, sem trocar o tenant ou duplicar a resposta", async () => {
    const repository = createRepository();
    (repository.queryReports as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("falha interna de relatórios"));
    const generator = vi.fn().mockResolvedValue({ content: "não deve gerar", provider: "deterministic", model: "pastoral-rules-v1" });
    const facade = new PastoralThanosFacade(repository, { generate: generator }, async () => pastoralToolCatalog);
    const tenantB: TenantContext = { ...context, organizationId: 2, organizationName: "Igreja Demonstração B", userId: 8, userName: "Pessoa B" };

    const result = await facade.respondMultiRead({
      context: tenantB,
      conversationId: 7,
      requestId: "multi-report-failure",
      message: "Resumo de células, presença e relatórios",
      tools: ["consultar_celulas", "consultar_presenca", "consultar_relatorios"],
    });

    expect(result).toMatchObject({
      provider: "deterministic",
      model: "thanos-multistep-fallback-v1",
      tool: "consultar_celulas,consultar_presenca,consultar_relatorios",
      requestId: "multi-report-failure",
    });
    expect(result.content).toContain("Há 2 células ativas.");
    expect(result.content).toContain("A presença foi 18.");
    expect(generator).not.toHaveBeenCalled();
    expect(repository.queryCells).toHaveBeenCalledWith(tenantB);
    expect(repository.queryAttendance).toHaveBeenCalledWith(tenantB);
    expect(repository.queryReports).toHaveBeenCalledWith(tenantB);
    expect(repository.appendMessage).toHaveBeenCalledTimes(1);
    expect(repository.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "agent.tool.execute",
      requestId: "multi-report-failure",
      result: "tool_execution_failed",
      status: "failure",
      tool: "consultar_relatorios",
      metadata: expect.objectContaining({ workspaceKey: "pastoral", tenantId: "org:2", step: 3, durationMs: expect.any(Number) }),
    }));
  });
});
