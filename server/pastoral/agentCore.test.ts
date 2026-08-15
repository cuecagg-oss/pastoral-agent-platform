import { describe, expect, it } from "vitest";
import { AgentCore } from "./agentCore";
import { AuthorizationError } from "./policy";
import type { PastoralRepository, TenantContext, ToolResult } from "./types";

const context: TenantContext = { organizationId: 1, organizationName: "Igreja Demonstração A", userId: 1, userName: "Pastor Samuel", role: "pastor" };

class FakeRepository implements PastoralRepository {
  audits: Array<{ action: string; status: string; tool?: string }> = [];
  messages: Array<{ role: string; content: string }> = [];
  followups = 0;
  private summary(tool: ToolResult["tool"]): ToolResult {
    return { tool, summary: "Resumo autorizado da Igreja Demonstração A.", data: { tenant: "A", count: 2 } };
  }
  queryCells() { return Promise.resolve(this.summary("consultar_celulas")); }
  queryReports() { return Promise.resolve(this.summary("consultar_relatorios")); }
  queryAttendance() { return Promise.resolve(this.summary("consultar_presenca")); }
  queryVisitors() { return Promise.resolve(this.summary("consultar_visitantes")); }
  queryLeaders() { return Promise.resolve(this.summary("consultar_lideres")); }
  findVisitor(_context: TenantContext, name: string) { return Promise.resolve(name === "João" ? { id: 21, name: "João", followedUp: false } : null); }
  appendMessage(input: { role: "user" | "assistant"; content: string }) { this.messages.push(input); return Promise.resolve(); }
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
});
