import { describe, expect, it } from "vitest";
import { AgentCore } from "./agentCore";
import { AgentGateway } from "./agentGateway";
import type { PastoralRepository, TenantContext, ToolResult } from "./types";

const context: TenantContext = { organizationId: 1, organizationName: "Igreja A", userId: 1, userName: "Pastor", role: "pastor" };

class GatewayRepository implements PastoralRepository {
  audits: Array<{ action: string; metadata?: Record<string, unknown> }> = [];
  queryCells() { return Promise.resolve(this.summary("consultar_celulas")); }
  queryReports() { return Promise.resolve(this.summary("consultar_relatorios")); }
  queryAttendance() { return Promise.resolve(this.summary("consultar_presenca")); }
  queryVisitors() { return Promise.resolve(this.summary("consultar_visitantes")); }
  queryLeaders() { return Promise.resolve(this.summary("consultar_lideres")); }
  findVisitor() { return Promise.resolve(null); }
  appendMessage() { return Promise.resolve(); }
  writeFollowup() { return Promise.resolve({ created: true, visitorName: "Ana" }); }
  audit(input: { action: string; metadata?: Record<string, unknown> }) { this.audits.push(input); return Promise.resolve(); }
  private summary(tool: ToolResult["tool"]): ToolResult { return { tool, summary: "Resumo seguro", data: { organizationId: 1 } }; }
}

describe("Agent Gateway", () => {
  it("mantém o Agent Core como fallback seguro e audita requestId", async () => {
    const repository = new GatewayRepository();
    const gateway = new AgentGateway(repository, new AgentCore(repository), async () => ({
      enabled: true,
      provider: "hermes",
      model: "hermes-pilot",
      hermes: { enabled: true, configured: false, model: "hermes-pilot", timeoutMs: 4_500 },
      fallbackPolicy: "deterministic",
      source: "organization",
    }));

    const response = await gateway.respond({ context, conversationId: 5, message: "Quais visitantes chegaram recentemente?", requestId: "request-pilot-1" });

    expect(response.gateway).toEqual({ version: "v1", provider: "hermes", fallback: true, fallbackReason: "hermes_unavailable" });
    expect(response.requestId).toBe("request-pilot-1");
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "agent_gateway.respond", metadata: expect.objectContaining({ requestId: "request-pilot-1", fallback: true }) }));
  });
});
