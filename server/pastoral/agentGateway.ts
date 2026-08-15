import { randomUUID } from "node:crypto";
import { AgentCore } from "./agentCore";
import { getAgentGatewayRuntimeConfig, type AgentGatewayRuntimeConfig } from "./gatewayConfig";
import { getTenantGatewayConfig, type TenantGatewayConfig } from "./tenantGatewayConfig";
import type { AgentResponse, PastoralRepository, TenantContext } from "./types";

const GATEWAY_NAME = "agent-gateway-v1";

type RespondInput = {
  context: TenantContext;
  conversationId: number;
  message: string;
  persistUserMessage?: boolean;
  requestId?: string;
};

export class AgentGateway {
  constructor(
    private readonly repository: PastoralRepository,
    private readonly legacyAgent: AgentCore,
    private readonly config: (context: TenantContext) => Promise<TenantGatewayConfig> = getTenantGatewayConfig,
  ) {}

  async respond(input: RespondInput): Promise<AgentResponse> {
    const requestId = input.requestId ?? randomUUID();
    const config = await this.config(input.context);
    const fallback = !config.enabled || config.provider === "hermes";
    const fallbackReason = !config.enabled ? "gateway_disabled" : "hermes_unavailable";
    const response = await this.legacyAgent.respond(input);

    await this.repository.audit({
      context: input.context,
      action: "agent_gateway.respond",
      agent: GATEWAY_NAME,
      model: response.model,
      tool: response.tool,
      status: "success",
      metadata: {
        requestId,
        provider: config.provider,
        configuredModel: config.model,
        fallback,
        fallbackReason: fallback ? fallbackReason : undefined,
        version: "v1",
      },
    });

    return {
      ...response,
      requestId,
      gateway: { version: "v1", provider: config.provider, fallback, fallbackReason: fallback ? fallbackReason : undefined },
    };
  }

  async confirmFollowup(input: { context: TenantContext; conversationId: number; visitorId: number; note: string; idempotencyKey: string; requestId?: string }) {
    const requestId = input.requestId ?? randomUUID();
    const response = await this.legacyAgent.confirmFollowup(input);
    await this.repository.audit({
      context: input.context,
      action: "agent_gateway.confirm",
      agent: GATEWAY_NAME,
      model: response.model,
      tool: response.tool,
      status: "success",
      metadata: { requestId, fallback: true, version: "v1" },
    });
    return { ...response, requestId, gateway: { version: "v1", provider: "legacy" as const, fallback: true, fallbackReason: "hermes_unavailable" as const } };
  }
}
