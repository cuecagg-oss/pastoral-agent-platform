import { randomUUID } from "node:crypto";
import { AgentCore } from "./agentCore";
import { getTenantGatewayConfig, type TenantGatewayConfig } from "./tenantGatewayConfig";
import { HermesClient, HermesUnavailableError, type HermesAttempt } from "./hermesClient";
import { toSanitizedTenantGatewayStatus } from "./tenantGatewayConfig";
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
    private readonly hermes = new HermesClient(),
  ) {}

  async getStatus(context: TenantContext) {
    const config = await this.config(context);
    return toSanitizedTenantGatewayStatus(config, this.hermes.getStatus(config));
  }

  async testHermesConnection(context: TenantContext) {
    const config = await this.config(context);
    const requestId = randomUUID();
    const probe = await this.hermes.probe(config, attempt => this.auditHermesAttempt(context, config, requestId, attempt));
    const status = this.hermes.getStatus(config);
    await this.repository.audit({
      context,
      action: "agent_gateway.hermes_probe",
      agent: GATEWAY_NAME,
      model: config.hermes.model,
      provider: "hermes",
      requestId,
      result: probe.connected ? "hermes_connected" : `hermes_${probe.failure ?? "unavailable"}`,
      confirmationStatus: "not_required",
      status: probe.connected ? "success" : "failure",
      metadata: { requestId, attempts: probe.attempts, latencyMs: probe.latencyMs, failure: probe.failure },
    });
    return { ...status, attempts: probe.attempts };
  }

  async respond(input: RespondInput): Promise<AgentResponse> {
    const requestId = input.requestId ?? randomUUID();
    const config = await this.config(input.context);
    let fallback = !config.enabled;
    let fallbackReason: "gateway_disabled" | "hermes_unavailable" | "hermes_circuit_open" | undefined = !config.enabled ? "gateway_disabled" : undefined;
    let response: AgentResponse;

    if (config.enabled && config.provider === "hermes") {
      try {
        response = await this.legacyAgent.respond({
          ...input,
          requestId,
          modelGenerator: {
            generate: generation => this.hermes.generate(
              config,
              { ...generation, requestId },
              attempt => this.auditHermesAttempt(input.context, config, requestId, attempt),
            ),
          },
        });
      } catch (error) {
        if (!(error instanceof HermesUnavailableError)) throw error;
        fallback = true;
        fallbackReason = error.failure === "circuit_open" ? "hermes_circuit_open" : "hermes_unavailable";
        response = await this.legacyAgent.respond({ ...input, requestId, persistUserMessage: false });
      }
    } else {
      response = await this.legacyAgent.respond({ ...input, requestId });
    }

    await this.repository.audit({
      context: input.context,
      action: "agent_gateway.respond",
      agent: GATEWAY_NAME,
      model: response.model,
      provider: config.provider,
      tool: response.tool,
      requestId,
      result: config.provider === "hermes" ? (fallback ? "hermes_fallback" : "hermes_response") : "gateway_response",
      confirmationStatus: response.confirmationStatus ?? "not_required",
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

  private async auditHermesAttempt(context: TenantContext, config: TenantGatewayConfig, requestId: string, attempt: HermesAttempt) {
    await this.repository.audit({
      context,
      action: "agent_gateway.hermes_attempt",
      agent: GATEWAY_NAME,
      model: config.hermes.model,
      provider: "hermes",
      requestId,
      result: attempt.success ? "hermes_attempt_success" : `hermes_attempt_${attempt.failure ?? "failure"}`,
      confirmationStatus: "not_required",
      status: attempt.success ? "success" : "failure",
      metadata: { requestId, attempt: attempt.attempt, latencyMs: attempt.latencyMs, failure: attempt.failure },
    });
  }

  async confirmFollowup(input: { context: TenantContext; conversationId: number; visitorId: number; note: string; idempotencyKey: string; requestId?: string }) {
    const requestId = input.requestId ?? randomUUID();
    const response = await this.legacyAgent.confirmFollowup({ ...input, requestId });
    await this.repository.audit({
      context: input.context,
      action: "agent_gateway.confirm",
      agent: GATEWAY_NAME,
      model: response.model,
      provider: "legacy",
      tool: response.tool,
      requestId,
      result: "gateway_confirmation",
      confirmationStatus: response.confirmationStatus ?? "confirmed",
      status: "success",
      metadata: { requestId, fallback: true, version: "v1" },
    });
    return { ...response, requestId, gateway: { version: "v1", provider: "legacy" as const, fallback: true, fallbackReason: "local_confirmation" as const } };
  }
}
