import { randomUUID } from "node:crypto";
import { getThanosPilotRuntimeConfig, type ThanosPilotDecision, type ThanosPilotRuntimeConfig, decideThanosPilotRoute } from "./thanosPilotConfig";
import type { AgentResponse, PastoralRepository, TenantContext } from "./types";
import type { ReadPastoralToolName } from "./types";

type LegacyResponder = Readonly<{
  respond(input: Readonly<{ context: TenantContext; conversationId: number; message: string; persistUserMessage?: boolean; requestId: string }>): Promise<AgentResponse>;
}>;

type ThanosResponder = Readonly<{
  respondRead(input: Readonly<{ context: TenantContext; conversationId: number; message: string; requestId: string; tool: ReadPastoralToolName }>): Promise<AgentResponse>;
  respondMultiRead(input: Readonly<{ context: TenantContext; conversationId: number; message: string; requestId: string; tools: readonly ReadPastoralToolName[] }>): Promise<AgentResponse>;
}>;

type RouterInput = Readonly<{ context: TenantContext; conversationId: number; message: string; requestId?: string }>;

const ROUTER_AGENT = "thanos-public-router";

/**
 * Roteia apenas mensagens elegíveis do chat público. A mensagem do usuário é persistida
 * neste adaptador exclusivamente no caminho THÁNOS; o legado preserva sua persistência original.
 */
export class ThanosPilotRouter {
  constructor(
    private readonly repository: PastoralRepository,
    private readonly legacy: LegacyResponder,
    private readonly thanos: ThanosResponder,
    private readonly resolveConfig: () => ThanosPilotRuntimeConfig = getThanosPilotRuntimeConfig,
    private readonly now: () => number = Date.now,
  ) {}

  async respond(input: RouterInput): Promise<AgentResponse> {
    const requestId = input.requestId ?? randomUUID();
    const startedAt = this.now();
    const decision = decideThanosPilotRoute({ context: input.context, message: input.message, config: this.resolveConfig() });
    if (decision.route === "legacy") {
      return this.respondLegacy({ ...input, requestId }, decision, startedAt);
    }

    try {
      await this.repository.appendMessage({ conversationId: input.conversationId, context: input.context, role: "user", content: input.message });
    } catch (_error) {
      return this.respondLegacyFallback({ ...input, requestId }, decision, startedAt, "user_message_persistence");
    }

    let marked: AgentResponse;
    try {
      const response = decision.mode === "multi_read"
        ? await this.thanos.respondMultiRead({ ...input, requestId, tools: decision.tools ?? [] })
        : await this.thanos.respondRead({ ...input, requestId, tool: decision.tools![0] });
      const softFallback = response.gateway?.fallback === true || response.model === "thanos-multistep-fallback-v1";
      marked = { ...response, thanos: { version: decision.version, mode: decision.mode!, tools: decision.tools ?? [], fallback: softFallback } } as AgentResponse;
    } catch (_error) {
      return this.respondLegacyFallback({ ...input, requestId }, decision, startedAt, "thanos_execution");
    }

    await this.auditRouteSafely(input.context, requestId, decision, "thanos", marked, startedAt, marked.thanos?.fallback ?? false);
    return marked;
  }

  private async respondLegacy(input: Required<RouterInput>, decision: ThanosPilotDecision, startedAt: number) {
    const response = await this.legacy.respond(input);
    await this.auditRouteSafely(input.context, input.requestId, decision, "legacy", response, startedAt, false);
    return response;
  }

  private async respondLegacyFallback(input: Required<RouterInput>, decision: ThanosPilotDecision, startedAt: number, failureStage: "user_message_persistence" | "thanos_execution") {
    const response = await this.legacy.respond({ ...input, persistUserMessage: failureStage === "thanos_execution" ? false : undefined });
    const marked = {
      ...response,
      thanos: { version: decision.version, mode: decision.mode!, tools: decision.tools ?? [], fallback: true, fallbackReason: "thanos_error" as const },
    } as AgentResponse;
    await this.auditRouteSafely(input.context, input.requestId, decision, "legacy_fallback", marked, startedAt, true, failureStage);
    return marked;
  }

  private async auditRouteSafely(
    context: TenantContext,
    requestId: string,
    decision: ThanosPilotDecision,
    route: "thanos" | "legacy" | "legacy_fallback",
    response: AgentResponse,
    startedAt: number,
    fallback: boolean,
    failureStage?: "user_message_persistence" | "thanos_execution",
  ) {
    try {
      await this.auditRoute(context, requestId, decision, route, response, startedAt, fallback, failureStage);
    } catch (_error) {
      try {
        await this.repository.audit({
          context,
          action: "thanos.route.telemetry_failed",
          agent: ROUTER_AGENT,
          provider: "telemetry",
          model: "thanos-router-v1",
          requestId,
          result: "post_response_telemetry_failed",
          confirmationStatus: "not_required",
          status: "failure",
          metadata: {
            route,
            decision: decision.reason,
            version: decision.version,
            fallback,
            durationMs: Math.max(0, this.now() - startedAt),
          },
        });
      } catch (_telemetryError) {
        console.error(`[THANOS] telemetry failure requestId=${requestId}`);
      }
    }
  }

  private async auditRoute(
    context: TenantContext,
    requestId: string,
    decision: ThanosPilotDecision,
    route: "thanos" | "legacy" | "legacy_fallback",
    response: AgentResponse,
    startedAt: number,
    fallback: boolean,
    failureStage?: "user_message_persistence" | "thanos_execution",
  ) {
    await this.repository.audit({
      context,
      action: "thanos.route",
      agent: ROUTER_AGENT,
      provider: route === "thanos" ? response.provider : "legacy",
      model: response.model,
      tool: response.tool,
      requestId,
      result: route === "thanos" ? (fallback ? "thanos_deterministic_fallback" : "thanos_response") : (fallback ? "thanos_legacy_fallback" : `legacy_${decision.reason}`),
      confirmationStatus: "not_required",
      status: "success",
      metadata: {
        route,
        decision: decision.reason,
        version: decision.version,
        mode: decision.mode ?? null,
        toolCount: decision.tools?.length ?? 0,
        tools: decision.tools?.join(",") ?? null,
        fallback,
        failureStage: failureStage ?? null,
        durationMs: Math.max(0, this.now() - startedAt),
      },
    });
  }
}
