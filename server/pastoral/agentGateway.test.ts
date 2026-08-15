import { describe, expect, it } from "vitest";
import { AgentCore } from "./agentCore";
import { AgentGateway } from "./agentGateway";
import { HermesClient } from "./hermesClient";
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
      hermes: { enabled: true, configured: false, model: "hermes-pilot", timeoutMs: 4_500, retries: 1, circuitFailureThreshold: 3, circuitCooldownMs: 30_000 },
      fallbackPolicy: "deterministic",
      source: "organization",
    }));

    const response = await gateway.respond({ context, conversationId: 5, message: "Quais visitantes chegaram recentemente?", requestId: "request-pilot-1" });

    expect(response.gateway).toEqual({ version: "v1", provider: "hermes", fallback: true, fallbackReason: "hermes_unavailable" });
    expect(response.requestId).toBe("request-pilot-1");
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "agent_gateway.respond", metadata: expect.objectContaining({ requestId: "request-pilot-1", fallback: true }) }));
  });

  it("audita teste Hermes sem incluir configurações internas", async () => {
    const repository = new GatewayRepository();
    const gateway = new AgentGateway(repository, new AgentCore(repository), async () => ({
      enabled: true,
      provider: "hermes",
      model: "hermes-pilot",
      hermes: { enabled: true, configured: false, model: "hermes-pilot", timeoutMs: 4_500, retries: 1, circuitFailureThreshold: 3, circuitCooldownMs: 30_000 },
      fallbackPolicy: "deterministic",
      source: "organization",
    }));

    const result = await gateway.testHermesConnection(context);

    expect(result).toMatchObject({ connection: "unconfigured", lastFailure: "unconfigured", attempts: 0 });
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "agent_gateway.hermes_probe", metadata: expect.objectContaining({ attempts: 0, failure: "unconfigured" }) }));
    expect(JSON.stringify(repository.audits)).not.toMatch(/api.?key|base.?url|token/i);
  });

  it("usa Hermes como gerador opt-in sobre a evidência local e audita a tentativa correlacionada", async () => {
    const repository = new GatewayRepository();
    const hermes = new HermesClient(
      async input => {
        expect(String(input)).toContain("v1/agent/respond");
        return new Response(JSON.stringify({ content: "Resposta Hermes baseada na evidência local.", model: "hermes-pilot" }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
      () => 100,
      "https://hermes.example/",
      "secret-not-returned",
    );
    const gateway = new AgentGateway(repository, new AgentCore(repository), async () => ({
      enabled: true,
      provider: "hermes",
      model: "hermes-pilot",
      hermes: { enabled: true, configured: true, model: "hermes-pilot", timeoutMs: 4_500, retries: 0, circuitFailureThreshold: 3, circuitCooldownMs: 30_000 },
      fallbackPolicy: "deterministic",
      source: "organization",
    }), hermes);

    const response = await gateway.respond({ context, conversationId: 5, message: "Quais visitantes chegaram recentemente?", requestId: "request-hermes-1" });

    expect(response).toMatchObject({ provider: "hermes", model: "hermes-pilot", content: "Resposta Hermes baseada na evidência local.", gateway: { provider: "hermes", fallback: false } });
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "agent_gateway.hermes_attempt", requestId: "request-hermes-1", metadata: expect.objectContaining({ attempt: 1 }) }));
    expect(repository.audits).toContainEqual(expect.objectContaining({ action: "agent_gateway.respond", result: "hermes_response" }));
    expect(JSON.stringify(repository.audits)).not.toMatch(/secret-not-returned|hermes\.example/i);
  });
});
