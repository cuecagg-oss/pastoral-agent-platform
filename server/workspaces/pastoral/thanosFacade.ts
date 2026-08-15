import { ModelRouter, type ModelGenerationInput, type ModelGenerationResult } from "../../pastoral/modelRouter";
import { ToolUnavailableError } from "../../pastoral/policy";
import { getToolCatalogEntry } from "../../pastoral/toolCatalog";
import { getTenantToolCatalog } from "../../pastoral/tenantToolConfig";
import { chooseReadTool, executeReadTool } from "../../pastoral/toolRegistry";
import type { AgentResponse, PastoralRepository, TenantContext, ToolCatalogEntry } from "../../pastoral/types";
import { ThanosReadOrchestrator, type ThanosAuditPort } from "../../thanos/orchestrator";
import { pastoralWorkspaceDefinition } from "./workspaceDefinition";

const AGENT_NAME = "assistente-pastoral";
const SYSTEM_PROMPT = "Você é um assistente pastoral. Responda em português, de forma objetiva, usando exclusivamente a evidência fornecida. Não invente dados, não exponha dados de outra organização e não revele raciocínio interno.";

export class PastoralThanosFacade {
  constructor(
    private readonly repository: PastoralRepository,
    private readonly modelRouter: { generate(input: ModelGenerationInput): Promise<ModelGenerationResult> } = new ModelRouter(),
    private readonly resolveToolCatalog: (context: TenantContext) => Promise<readonly ToolCatalogEntry[]> = getTenantToolCatalog,
  ) {}

  async respondRead(input: Readonly<{
    context: TenantContext;
    conversationId: number;
    message: string;
    requestId: string;
    modelGenerator?: { generate(input: ModelGenerationInput): Promise<ModelGenerationResult> };
  }>): Promise<AgentResponse> {
    const thanosContext = pastoralWorkspaceDefinition.resolveContext({
      tenantContext: input.context,
      channel: "chat",
      conversationId: input.conversationId,
      serverRequestId: input.requestId,
    });
    const tool = chooseReadTool(input.message);
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
          metadata: { workspaceKey: event.context.workspaceKey, domain: event.context.domain },
        });
      },
    };
    const orchestrator = new ThanosReadOrchestrator(audit);

    try {
      const result = await orchestrator.run({
        context: thanosContext,
        tool: {
          name: tool,
          requiredCapability: "agent:read",
          execute: async () => executeReadTool(this.repository, input.context, tool, toolCatalog),
        },
        system: SYSTEM_PROMPT,
        user: `Pergunta: ${input.message}`,
        generator: {
          generate: async generationInput => (input.modelGenerator ?? this.modelRouter).generate({
            system: generationInput.system,
            user: `${generationInput.user}\n\nEvidência da ferramenta ${tool}: ${JSON.stringify(generationInput.evidence.data)}`,
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
    } catch (error) {
      if (error instanceof ToolUnavailableError) {
        throw error;
      }
      throw error;
    }
  }
}
