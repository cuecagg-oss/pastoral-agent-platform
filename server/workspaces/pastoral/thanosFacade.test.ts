import { describe, expect, it, vi } from "vitest";
import { pastoralToolCatalog } from "../../pastoral/toolCatalog";
import { ModelRouter } from "../../pastoral/modelRouter";
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

  it("seleciona e persiste consultar_relatorios uma única vez com auditoria sanitizada", async () => {
    const repository = createRepository();
    const message = "Quais relatórios pendentes existem?";
    const facade = new PastoralThanosFacade(
      repository,
      { generate: vi.fn().mockResolvedValue({ content: "Há 1 relatório pendente.", provider: "deterministic", model: "pastoral-rules-v1" }) },
      async () => pastoralToolCatalog,
    );

    const result = await facade.respondRead({ context, conversationId: 9, message, requestId: "report-single" });

    expect(result).toMatchObject({ tool: "consultar_relatorios", requestId: "report-single" });
    expect(repository.queryReports).toHaveBeenCalledWith(context);
    expect(repository.appendMessage).toHaveBeenCalledTimes(1);
    expect(repository.appendMessage).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 9, tool: "consultar_relatorios" }));
    const auditEvents = (repository.audit as ReturnType<typeof vi.fn>).mock.calls.map(([event]) => event);
    expect(auditEvents).toContainEqual(expect.objectContaining({ requestId: "report-single", tool: "consultar_relatorios" }));
    expect(JSON.stringify(auditEvents)).not.toContain(message);
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
    const stepEvents = (repository.audit as ReturnType<typeof vi.fn>).mock.calls
      .map(([event]) => event)
      .filter(event => event.action === "agent.tool.execute" && event.requestId === "multi-3");
    expect(stepEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ tool: "consultar_celulas", metadata: expect.objectContaining({ step: 1, durationMs: expect.any(Number) }) }),
      expect.objectContaining({ tool: "consultar_presenca", metadata: expect.objectContaining({ step: 2, durationMs: expect.any(Number) }) }),
      expect.objectContaining({ tool: "consultar_relatorios", metadata: expect.objectContaining({ step: 3, durationMs: expect.any(Number) }) }),
    ]));
    expect(stepEvents.every(event => event.metadata.durationMs >= 0)).toBe(true);
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

  it("recusa consultar_relatorios desabilitado antes da consulta e não persiste resposta", async () => {
    const repository = createRepository();
    const disabledCatalog = pastoralToolCatalog.map(entry => entry.name === "consultar_relatorios" ? { ...entry, enabled: false } : entry);
    const facade = new PastoralThanosFacade(repository, new ModelRouter(), async () => disabledCatalog);

    await expect(facade.respondRead({ context, conversationId: 10, message: "Relatórios pendentes", requestId: "report-disabled", tool: "consultar_relatorios" })).rejects.toThrow("desabilitada");

    expect(repository.queryReports).not.toHaveBeenCalled();
    expect(repository.appendMessage).not.toHaveBeenCalled();
    expect(repository.audit).toHaveBeenCalledWith(expect.objectContaining({ requestId: "report-disabled", tool: "consultar_relatorios", status: "failure", result: "tool_or_generation_failed" }));
  });

  it("recusa consultar_relatorios para papel não autorizado antes da consulta e persistência", async () => {
    const repository = createRepository();
    const unprivilegedContext: TenantContext = { ...context, role: "user" };
    const facade = new PastoralThanosFacade(repository, new ModelRouter(), async () => pastoralToolCatalog);

    await expect(facade.respondRead({ context: unprivilegedContext, conversationId: 11, message: "Relatórios pendentes", requestId: "report-role-denied", tool: "consultar_relatorios" })).rejects.toThrow("função não possui permissão");

    expect(repository.queryReports).not.toHaveBeenCalled();
    expect(repository.appendMessage).not.toHaveBeenCalled();
    expect(repository.audit).toHaveBeenCalledWith(expect.objectContaining({ requestId: "report-role-denied", tool: "consultar_relatorios", status: "failure", result: "tool_or_generation_failed" }));
  });
});
