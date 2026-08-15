import { ModelRouter, type ModelGenerationInput, type ModelGenerationResult } from "../../pastoral/modelRouter";
import { getTenantToolCatalog } from "../../pastoral/tenantToolConfig";
import type { AgentResponse, PastoralRepository, TenantContext, ToolCatalogEntry } from "../../pastoral/types";
import { thanosSkillRegistry, thanosWorkspaceRegistry } from "../../thanos/defaultRegistries";
import { ThanosMultiStepReadOrchestrator, ThanosReadOrchestrator, type ThanosAuditPort } from "../../thanos/orchestrator";
import { createPastoralDeclaredReadToolAdapter, createPastoralMultiStepReadAdapters, createPastoralReadToolAdapter } from "./pastoralToolAdapter";
import type { ReadPastoralToolName } from "../../pastoral/types";

const AGENT_NAME = "assistente-pastoral";
const SYSTEM_PROMPT = "Você é um assistente pastoral. Responda em português, de forma objetiva, usando exclusivamente a evidência fornecida. Não invente dados, não exponha dados de outra organização e não revele raciocínio interno.";

export class PastoralThanosFacade {
  constructor(
    private readonly repository: PastoralRepository,
    private readonly modelRouter: { generate(input: ModelGenerationInput): Promise<ModelGenerationResult> } = new ModelRouter(),
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
          metadata: { workspaceKey: event.context.workspaceKey, domain: event.context.domain, step: event.step },
        });
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
    modelGenerator?: { generate(input: ModelGenerationInput): Promise<ModelGenerationResult> };
  }>): Promise<AgentResponse> {
    const { thanosContext, skill, toolCatalog, audit } = await this.resolveInvocation(input);
    const tool = input.tool
      ? createPastoralDeclaredReadToolAdapter({ repository: this.repository, tenantContext: input.context, thanosContext, skill, toolCatalog, tool: input.tool })
      : createPastoralReadToolAdapter({ repository: this.repository, tenantContext: input.context, thanosContext, skill, toolCatalog, message: input.message });
    const orchestrator = new ThanosReadOrchestrator(audit);

    const result = await orchestrator.run({
      context: thanosContext,
      tool,
      system: SYSTEM_PROMPT,
      user: `Pergunta: ${input.message}`,
      generator: {
        generate: async generationInput => (input.modelGenerator ?? this.modelRouter).generate({
          system: generationInput.system,
          user: `${generationInput.user}\n\nEvidência da ferramenta ${tool.name}: ${JSON.stringify(generationInput.evidence.data)}`,
          fallback: generationInput.fallback,
        }),
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
    };
  }

  async respondMultiRead(input: Readonly<{
    context: TenantContext;
    conversationId: number;
    message: string;
    requestId: string;
    tools: readonly ReadPastoralToolName[];
    modelGenerator?: { generate(input: ModelGenerationInput): Promise<ModelGenerationResult> };
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
    const result = await orchestrator.run({
      context: thanosContext,
      steps,
      system: SYSTEM_PROMPT,
      user: `Pergunta: ${input.message}`,
      generator: {
        generate: async generationInput => (input.modelGenerator ?? this.modelRouter).generate({
          system: generationInput.system,
          user: `${generationInput.user}\n\nEvidências compostas das ferramentas ${resultToolNames(steps)}: ${JSON.stringify(generationInput.evidence.data)}`,
          fallback: generationInput.fallback,
        }),
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
    };
  }
}

function resultToolNames(steps: readonly { name: string }[]) {
  return steps.map(step => step.name).join(", ");
}
