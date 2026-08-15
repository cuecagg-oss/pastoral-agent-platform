import { describe, expect, it } from "vitest";
import { AgentCore } from "./agentCore";
import { AuthorizationError, ToolUnavailableError } from "./policy";
import { pastoralToolCatalog } from "./toolCatalog";
import type { PastoralRepository, TenantContext, ToolCatalogEntry, ToolResult } from "./types";
import { createVoiceHistoryEntry, VOICE_HISTORY_LABEL } from "./voiceUploadRoute";

const context: TenantContext = { organizationId: 1, organizationName: "Igreja Demonstração A", userId: 1, userName: "Pastor Samuel", role: "pastor" };

class FakeRepository implements PastoralRepository {
  audits: Array<{ action: string; status: string; tool?: string }> = [];
  messages: Array<{ role: string; content: string; messageType?: string }> = [];
  readTools: string[] = [];
  followups = 0;
  private summary(tool: ToolResult["tool"]): ToolResult {
    return { tool, summary: "Resumo autorizado da Igreja Demonstração A.", data: { tenant: "A", count: 2 } };
  }
  queryCells() { this.readTools.push("consultar_celulas"); return Promise.resolve(this.summary("consultar_celulas")); }
  queryReports() { this.readTools.push("consultar_relatorios"); return Promise.resolve(this.summary("consultar_relatorios")); }
  queryAttendance() { this.readTools.push("consultar_presenca"); return Promise.resolve(this.summary("consultar_presenca")); }
  queryVisitors() { this.readTools.push("consultar_visitantes"); return Promise.resolve(this.summary("consultar_visitantes")); }
  queryLeaders() { this.readTools.push("consultar_lideres"); return Promise.resolve(this.summary("consultar_lideres")); }
  findVisitor(_context: TenantContext, name: string) { return Promise.resolve(name === "João" ? { id: 21, name: "João", followedUp: false } : null); }
  appendMessage(input: { role: "user" | "assistant"; content: string; messageType?: "text" | "voice" }) { this.messages.push(input); return Promise.resolve(); }
  writeFollowup() { this.followups += 1; return Promise.resolve({ created: this.followups === 1, visitorName: "João" }); }
  audit(input: { action: string; status: "success" | "failure" | "denied"; tool?: string }) { this.audits.push(input); return Promise.resolve(); }
}

describe("Agent Core pastoral", () => {
  it("responde por ferramenta autorizada e audita sem expor raciocínio", async () => {
    const repository = new FakeRepository();
    const agent = new AgentCore(repository);
    const result = await agent.respond({ context, conversationId: 4, message: "Quais células realizaram reunião esta semana?" });
    expect(result.tool).toBe("consultar_presenca");
    expect(result.content).toContain("Resumo autorizado");
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "agent.respond", status: "success", tool: "consultar_presenca" }));
    expect(repository.messages).toHaveLength(2);
  });

  it("não confunde quantidade de igrejas com quantidade de células", async () => {
    const repository = new FakeRepository();
    const agent = new AgentCore(repository);

    const result = await agent.respond({ context, conversationId: 4, message: "Quantas igrejas existem?" });

    expect(result.tool).toBeUndefined();
    expect(result.content).toContain("Igreja Demonstração A");
    expect(result.content).toContain("não contabilizo");
    expect(repository.readTools).toEqual([]);
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "agent.respond", status: "success" }));
  });

  it("mantém a transcrição de voz interna e registra somente a resposta do agente", async () => {
    const repository = new FakeRepository();
    const agent = new AgentCore(repository);

    await agent.respond({
      context,
      conversationId: 4,
      message: "Quantas células realizaram reunião esta semana?",
      persistUserMessage: false,
    });

    expect(repository.messages).toHaveLength(1);
    expect(repository.messages[0]).toMatchObject({ role: "assistant" });
    expect(repository.messages.some(message => message.content.includes("Quantas células"))).toBe(false);
  });

  it("mantém o marcador privado de voz antes da resposta sem persistir a fala reconhecida", async () => {
    const repository = new FakeRepository();
    const agent = new AgentCore(repository);
    const recognizedSpeech = "Quantas células realizaram reunião esta semana?";

    await repository.appendMessage(createVoiceHistoryEntry(4, context));
    await agent.respond({ context, conversationId: 4, message: recognizedSpeech, persistUserMessage: false });

    expect(repository.messages).toHaveLength(2);
    expect(repository.messages[0]).toMatchObject({ role: "user", messageType: "voice", content: VOICE_HISTORY_LABEL });
    expect(repository.messages[1]).toMatchObject({ role: "assistant" });
    expect(repository.messages.some(message => message.content.includes(recognizedSpeech))).toBe(false);
  });

  it("exige confirmação e mantém idempotência da Write Tool", async () => {
    const repository = new FakeRepository();
    const agent = new AgentCore(repository);
    const prepared = await agent.respond({ context, conversationId: 4, message: "Registre que o pastor entrou em contato com João hoje." });
    expect(prepared.confirmation?.visitorName).toBe("João");
    expect(repository.followups).toBe(0);
    const first = await agent.confirmFollowup({ context, conversationId: 4, ...prepared.confirmation! });
    const second = await agent.confirmFollowup({ context, conversationId: 4, ...prepared.confirmation! });
    expect(first.content).toContain("registrado com sucesso");
    expect(second.content).toContain("já havia sido registrado");
    expect(repository.followups).toBe(2);
  });

  it("nega escrita a líder e audita a recusa", async () => {
    const repository = new FakeRepository();
    const agent = new AgentCore(repository);
    await expect(agent.respond({ context: { ...context, role: "leader" }, conversationId: 4, message: "Registre que o pastor entrou em contato com João hoje." })).rejects.toThrow(AuthorizationError);
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "followup.prepare", status: "denied" }));
  });

  it("recusa ferramenta desabilitada antes de consultar dados e audita a decisão", async () => {
    const repository = new FakeRepository();
    const disabledCatalog: ToolCatalogEntry[] = pastoralToolCatalog.map(entry => (
      entry.name === "consultar_celulas" ? { ...entry, enabled: false } : entry
    ));
    const agent = new AgentCore(repository, undefined, async () => disabledCatalog);

    await expect(agent.respond({ context, conversationId: 4, message: "Como estão as células desta semana?" })).rejects.toThrow(ToolUnavailableError);

    expect(repository.readTools).toEqual([]);
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "agent.tool.execute", status: "denied", tool: "consultar_celulas" }));
  });

  it("recusa consulta sensível a papel não autorizado antes de acessar o repositório", async () => {
    const repository = new FakeRepository();
    const agent = new AgentCore(repository);

    await expect(agent.respond({ context: { ...context, role: "leader" }, conversationId: 4, message: "Quais visitantes precisam de acompanhamento?" })).rejects.toThrow(AuthorizationError);

    expect(repository.readTools).toEqual([]);
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "agent.tool.execute", status: "denied", tool: "consultar_visitantes" }));
  });
});
