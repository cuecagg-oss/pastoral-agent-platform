import { describe, expect, it } from "vitest";
import { ThanosPilotRouter } from "./thanosPilotRouter";
import { resolveThanosPilotRuntimeConfig } from "./thanosPilotConfig";
import type { AgentResponse, PastoralRepository, TenantContext, ToolResult } from "./types";

const context: TenantContext = { organizationId: 1, organizationName: "Igreja A", userId: 10, userName: "Ana", role: "pastor" };
const response: AgentResponse = { content: "Resposta segura", provider: "deterministic", model: "test-model", confirmationStatus: "not_required" };
const pilotConfig = () => resolveThanosPilotRuntimeConfig({ enabled: "true", killSwitch: "false", organizationIds: "1", userIds: "10", version: "pilot-v1" });

class PilotRepository implements PastoralRepository {
  messages: Array<{ role: string; content: string }> = [];
  audits: Array<{ action: string; requestId?: string; metadata?: Record<string, unknown> }> = [];
  queryCells() { return Promise.resolve({ tool: "consultar_celulas", summary: "", data: {} } as ToolResult); }
  queryReports() { return Promise.resolve({ tool: "consultar_relatorios", summary: "", data: {} } as ToolResult); }
  queryAttendance() { return Promise.resolve({ tool: "consultar_presenca", summary: "", data: {} } as ToolResult); }
  queryVisitors() { return Promise.resolve({ tool: "consultar_visitantes", summary: "", data: {} } as ToolResult); }
  queryLeaders() { return Promise.resolve({ tool: "consultar_lideres", summary: "", data: {} } as ToolResult); }
  findVisitor() { return Promise.resolve(null); }
  appendMessage(input: { role: "user" | "assistant"; content: string }) { this.messages.push(input); return Promise.resolve(); }
  writeFollowup() { return Promise.resolve({ created: true, visitorName: "Ana" }); }
  audit(input: { action: string; requestId?: string; metadata?: Record<string, unknown> }) { this.audits.push(input); return Promise.resolve(); }
}

describe("ThanosPilotRouter", () => {
  it("roteia leitura elegível, persiste o usuário uma vez e audita dados sanitizados", async () => {
    const repository = new PilotRepository();
    let legacyCalls = 0;
    let seenTools: readonly string[] = [];
    const router = new ThanosPilotRouter(repository, {
      respond: async () => { legacyCalls += 1; return response; },
    }, {
      respondRead: async () => response,
      respondMultiRead: async input => { seenTools = input.tools; return { ...response, tool: input.tools.join(",") }; },
    }, pilotConfig, () => 500);

    const result = await router.respond({ context, conversationId: 9, message: "Mostre um resumo de células, presença e relatórios", requestId: "pilot-request-1" });

    expect(legacyCalls).toBe(0);
    expect(seenTools).toEqual(["consultar_celulas", "consultar_presenca", "consultar_relatorios"]);
    expect(repository.messages).toEqual([expect.objectContaining({ role: "user", content: "Mostre um resumo de células, presença e relatórios" })]);
    expect(result.thanos).toEqual({ version: "pilot-v1", mode: "multi_read", tools: ["consultar_celulas", "consultar_presenca", "consultar_relatorios"], fallback: false });
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "thanos.route", requestId: "pilot-request-1", metadata: expect.objectContaining({ route: "thanos", toolCount: 3, durationMs: 0 }) }));
    expect(JSON.stringify(repository.audits)).not.toMatch(/organizationIds|userIds|api.?key|token|secret/i);
  });

  it("desliga imediatamente o THÁNOS pelo kill switch e mantém a persistência do legado", async () => {
    const repository = new PilotRepository();
    let receivedPersistFlag: boolean | undefined;
    const router = new ThanosPilotRouter(repository, {
      respond: async input => { receivedPersistFlag = input.persistUserMessage; return response; },
    }, {
      respondRead: async () => { throw new Error("não deveria executar"); },
      respondMultiRead: async () => { throw new Error("não deveria executar"); },
    }, () => resolveThanosPilotRuntimeConfig({ enabled: "true", killSwitch: "true", organizationIds: "1", userIds: "10", version: "pilot-v1" }));

    await router.respond({ context, conversationId: 9, message: "Quais células temos?", requestId: "kill-switch-request" });

    expect(receivedPersistFlag).toBeUndefined();
    expect(repository.messages).toEqual([]);
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "thanos.route", metadata: expect.objectContaining({ route: "legacy", decision: "kill_switch" }) }));
  });

  it("usa legado sem duplicar a mensagem quando a execução THÁNOS falha", async () => {
    const repository = new PilotRepository();
    let receivedPersistFlag: boolean | undefined;
    const router = new ThanosPilotRouter(repository, {
      respond: async input => { receivedPersistFlag = input.persistUserMessage; return response; },
    }, {
      respondRead: async () => { throw new Error("falha interna não exposta"); },
      respondMultiRead: async () => { throw new Error("falha interna não exposta"); },
    }, pilotConfig, () => 10);

    const result = await router.respond({ context, conversationId: 9, message: "Quais células temos?", requestId: "fallback-request" });

    expect(receivedPersistFlag).toBe(false);
    expect(repository.messages).toEqual([expect.objectContaining({ role: "user", content: "Quais células temos?" })]);
    expect(result.thanos).toMatchObject({ fallback: true, fallbackReason: "thanos_error" });
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "thanos.route", requestId: "fallback-request", metadata: expect.objectContaining({ route: "legacy_fallback", fallback: true }) }));
  });

  it("expõe somente o status sanitizado quando o multi-step usa fallback determinístico", async () => {
    const repository = new PilotRepository();
    const router = new ThanosPilotRouter(repository, { respond: async () => response }, {
      respondRead: async () => response,
      respondMultiRead: async () => ({ ...response, model: "thanos-multistep-fallback-v1" }),
    }, pilotConfig, () => 10);

    const result = await router.respond({ context, conversationId: 9, message: "Mostre um resumo de células e presença", requestId: "deterministic-fallback" });

    expect(result.thanos).toMatchObject({ version: "pilot-v1", fallback: true });
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "thanos.route", result: "thanos_deterministic_fallback", metadata: expect.objectContaining({ route: "thanos", fallback: true }) }));
    expect(JSON.stringify(repository.audits)).not.toContain("internal");
  });
});
