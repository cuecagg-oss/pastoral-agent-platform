import type { ModelGenerationInput, ModelGenerationResult } from "../../pastoral/modelRouter";
import { getTenantToolCatalog } from "../../pastoral/tenantToolConfig";
import type { AgentResponse, PastoralRepository, TenantContext, ToolCatalogEntry } from "../../pastoral/types";
import { thanosSkillRegistry, thanosWorkspaceRegistry } from "../../thanos/defaultRegistries";
import { ThanosMultiStepReadOrchestrator, ThanosReadOrchestrator, type ThanosAuditPort } from "../../thanos/orchestrator";
import { createPastoralDeclaredReadToolAdapter, createPastoralMultiStepReadAdapters, createPastoralReadToolAdapter } from "./pastoralToolAdapter";
import type { ReadPastoralToolName } from "../../pastoral/types";

const AGENT_NAME = "assistente-pastoral";
const SYSTEM_PROMPT = "Você é um assistente pastoral. Responda em português, de forma objetiva, usando exclusivamente a evidência fornecida. Não invente dados, não exponha dados de outra organização e não revele raciocínio interno.";

type PastoralGenerationInput = ModelGenerationInput & Readonly<{ context: TenantContext; requestId: string }>;
type PastoralGenerationPort = Readonly<{ generate(input: PastoralGenerationInput): Promise<ModelGenerationResult> }>;

export class PastoralThanosFacade {
  constructor(
    private readonly repository: PastoralRepository,
    private readonly modelRouter: PastoralGenerationPort,
    private readonly resolveToolCatalog: (context: TenantContext) => Promise<readonly ToolCatalogEntry[]> = getTenantToolCatalog,
  ) {}

  private async resolveInvocation(input: Readonly<{ context: TenantContext; conversationId: number; requestId: string }>) {
    const workspace = thanosWorkspaceRegistry.get("pastoral");
    const thanosContext = workspace.resolveContext({
      tenantContext: input.context,
      channel: "chat",
      conversationId: input.conversationId,
      serverRequestId: input.requestId,
    });
    const skill = thanosSkillRegistry.getForWorkspace(thanosContext.workspaceKey, "pastoral-assistant");
    const toolCatalog = await this.resolveToolCatalog(input.context);
    const audit: ThanosAuditPort = {
      record: async event => {
        const denied = event.status === "denied";
        try {
          await this.repository.audit({
            context: input.context,
            action: event.action === "thanos.read" ? "agent.respond" : "agent.tool.execute",
            agent: AGENT_NAME,
            provider: event.provider ?? "deterministic",
            model: event.model ?? "pastoral-rules-v1",
            tool: event.tool,
            requestId: event.context.requestId,
            result: event.result,
            confirmationStatus: "not_required",
            status: denied ? "denied" : event.status,
            metadata: {
              workspaceKey: event.context.workspaceKey,
              tenantId: event.context.tenantId,
              domain: event.context.domain,
              step: event.step,
              durationMs: event.durationMs === undefined ? undefined : Math.max(0, event.durationMs),
            },
          });
        } catch (_error) {
          console.error(`[PastoralThanosFacade] telemetry failure requestId=${event.context.requestId}`);
        }
      },
    };
    return { thanosContext, skill, toolCatalog, audit };
  }

  async respondRead(input: Readonly<{
    context: TenantContext;
    conversationId: number;
    message: string;
    requestId: string;
    tool?: ReadPastoralToolName;
    modelGenerator?: PastoralGenerationPort;
  }>): Promise<AgentResponse> {
    const { thanosContext, skill, toolCatalog, audit } = await this.resolveInvocation(input);
    const tool = input.tool
      ? createPastoralDeclaredReadToolAdapter({ repository: this.repository, tenantContext: input.context, thanosContext, skill, toolCatalog, tool: input.tool })
      : createPastoralReadToolAdapter({ repository: this.repository, tenantContext: input.context, thanosContext, skill, toolCatalog, message: input.message });
    const orchestrator = new ThanosReadOrchestrator(audit);

    let gateway: ModelGenerationResult["gateway"];
    const result = await orchestrator.run({
      context: thanosContext,
      tool,
      system: SYSTEM_PROMPT,
      user: `Pergunta: ${input.message}`,
      generator: {
        generate: async generationInput => {
          const generated = await (input.modelGenerator ?? this.modelRouter).generate({
            context: input.context,
            requestId: input.requestId,
            system: generationInput.system,
            user: `${generationInput.user}\n\nResumo autorizado da ferramenta ${tool.name}: ${generationInput.evidence.summary}`,
            fallback: generationInput.fallback,
          });
          gateway = generated.gateway;
          return generated;
        },
      },
    });
    await this.repository.appendMessage({
      conversationId: input.conversationId,
      context: input.context,
      role: "assistant",
      content: result.content,
      model: result.model,
      tool: tool.name,
    });
    return {
      content: result.content,
      provider: result.provider,
      model: result.model,
      tool: tool.name,
      requestId: result.requestId,
      confirmationStatus: "not_required",
      ...(gateway ? { gateway } : {}),
    };
  }

  async respondMultiRead(input: Readonly<{
    context: TenantContext;
    conversationId: number;
    message: string;
    requestId: string;
    tools: readonly ReadPastoralToolName[];
    modelGenerator?: PastoralGenerationPort;
  }>): Promise<AgentResponse> {
    const { thanosContext, skill, toolCatalog, audit } = await this.resolveInvocation(input);
    const steps = createPastoralMultiStepReadAdapters({
      repository: this.repository,
      tenantContext: input.context,
      thanosContext,
      skill,
      toolCatalog,
      tools: input.tools,
    });
    const orchestrator = new ThanosMultiStepReadOrchestrator(audit);
    let gateway: ModelGenerationResult["gateway"];
    const result = await orchestrator.run({
      context: thanosContext,
      steps,
      system: SYSTEM_PROMPT,
      user: `Pergunta: ${input.message}`,
      generator: {
        generate: async generationInput => {
          const generated = await (input.modelGenerator ?? this.modelRouter).generate({
            context: input.context,
            requestId: input.requestId,
            system: generationInput.system,
            user: `${generationInput.user}\n\nResumos autorizados das ferramentas ${resultToolNames(steps)}: ${generationInput.evidence.summary}`,
            fallback: generationInput.fallback,
          });
          gateway = generated.gateway;
          return generated;
        },
      },
    });
    const tool = result.tools.join(",");
    await this.repository.appendMessage({
      conversationId: input.conversationId,
      context: input.context,
      role: "assistant",
      content: result.content,
      model: result.model,
      tool,
    });
    return {
      content: result.content,
      provider: result.provider,
      model: result.model,
      tool,
      requestId: result.requestId,
      confirmationStatus: "not_required",
      ...(gateway ? { gateway } : {}),
    };
  }
}

function resultToolNames(steps: readonly { name: string }[]) {
  return steps.map(step => step.name).join(", ");
}
