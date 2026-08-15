import { randomUUID } from "node:crypto";
import { ModelRouter } from "./modelRouter";
import { assertFollowupPermission } from "./policy";
import { chooseReadTool, executeReadTool, extractVisitorName, isFollowupIntent, isOrganizationCountIntent } from "./toolRegistry";
import type { AgentResponse, PastoralRepository, TenantContext } from "./types";

const AGENT_NAME = "assistente-pastoral";

export class AgentCore {
  constructor(
    private readonly repository: PastoralRepository,
    private readonly modelRouter = new ModelRouter(),
  ) {}

  async respond(input: { context: TenantContext; conversationId: number; message: string }): Promise<AgentResponse> {
    const { context, conversationId, message } = input;
    await this.repository.appendMessage({ conversationId, context, role: "user", content: message });

    if (isFollowupIntent(message)) {
      try {
        assertFollowupPermission(context);
      } catch (error) {
        await this.repository.audit({ context, action: "followup.prepare", agent: AGENT_NAME, tool: "registrar_acompanhamento_visitante", status: "denied", metadata: { reason: "role_not_allowed" } });
        throw error;
      }
      const visitorName = extractVisitorName(message);
      const visitor = visitorName ? await this.repository.findVisitor(context, visitorName) : null;
      if (!visitor) {
        const content = "Não consegui identificar um visitante desta igreja pelo nome informado. Informe o nome completo para preparar o acompanhamento.";
        await this.repository.appendMessage({ conversationId, context, role: "assistant", content, model: "pastoral-rules-v1" });
        await this.repository.audit({ context, action: "followup.prepare", agent: AGENT_NAME, status: "failure", metadata: { reason: "visitor_not_found" } });
        return { content, provider: "deterministic", model: "pastoral-rules-v1" };
      }
      const note = `Acompanhamento solicitado por ${context.userName}: ${message}`;
      const content = `Encontrei **${visitor.name}**. Posso registrar este acompanhamento agora? A confirmação gravará uma única operação auditável.`;
      const idempotencyKey = randomUUID();
      await this.repository.appendMessage({ conversationId, context, role: "assistant", content, model: "pastoral-rules-v1", tool: "registrar_acompanhamento_visitante" });
      await this.repository.audit({ context, action: "followup.prepare", agent: AGENT_NAME, tool: "registrar_acompanhamento_visitante", status: "success", metadata: { visitorId: visitor.id } });
      return {
        content,
        provider: "deterministic",
        model: "pastoral-rules-v1",
        tool: "registrar_acompanhamento_visitante",
        confirmation: { visitorId: visitor.id, visitorName: visitor.name, note, idempotencyKey },
      };
    }

    if (isOrganizationCountIntent(message)) {
      const content = `Você está consultando a **${context.organizationName}**. Para preservar a privacidade entre organizações, eu não contabilizo nem revelo outras igrejas. Posso informar dados autorizados da igreja atual, como células, relatórios, presença, visitantes e líderes.`;
      await this.repository.appendMessage({ conversationId, context, role: "assistant", content, model: "pastoral-rules-v1" });
      await this.repository.audit({
        context,
        action: "agent.respond",
        agent: AGENT_NAME,
        model: "pastoral-rules-v1",
        status: "success",
        metadata: { provider: "deterministic", intent: "organization_count_out_of_scope" },
      });
      return { content, provider: "deterministic", model: "pastoral-rules-v1" };
    }

    const tool = chooseReadTool(message);
    const toolResult = await executeReadTool(this.repository, context, tool);
    const model = await this.modelRouter.generate({
      system: "Você é um assistente pastoral. Responda em português, de forma objetiva, usando exclusivamente a evidência fornecida. Não invente dados, não exponha dados de outra organização e não revele raciocínio interno.",
      user: `Pergunta: ${message}\n\nEvidência da ferramenta ${tool}: ${JSON.stringify(toolResult.data)}`,
      fallback: toolResult.summary,
    });

    await this.repository.appendMessage({ conversationId, context, role: "assistant", content: model.content, model: model.model, tool });
    await this.repository.audit({ context, action: "agent.respond", agent: AGENT_NAME, model: model.model, tool, status: "success", metadata: { provider: model.provider } });
    return { content: model.content, provider: model.provider, model: model.model, tool };
  }

  async confirmFollowup(input: { context: TenantContext; conversationId: number; visitorId: number; note: string; idempotencyKey: string }): Promise<AgentResponse> {
    try {
      assertFollowupPermission(input.context);
    } catch (error) {
      await this.repository.audit({ context: input.context, action: "followup.confirm", agent: AGENT_NAME, tool: "registrar_acompanhamento_visitante", status: "denied", metadata: { reason: "role_not_allowed" } });
      throw error;
    }
    const result = await this.repository.writeFollowup(input);
    const content = result.created
      ? `Acompanhamento de **${result.visitorName}** registrado com sucesso e incluído no histórico de auditoria.`
      : `O acompanhamento de **${result.visitorName}** já havia sido registrado; nenhuma duplicação foi criada.`;
    await this.repository.appendMessage({ conversationId: input.conversationId, context: input.context, role: "assistant", content, model: "pastoral-rules-v1", tool: "registrar_acompanhamento_visitante" });
    await this.repository.audit({ context: input.context, action: "followup.confirm", agent: AGENT_NAME, model: "pastoral-rules-v1", tool: "registrar_acompanhamento_visitante", status: "success", metadata: { visitorId: input.visitorId, created: result.created } });
    return { content, provider: "deterministic", model: "pastoral-rules-v1", tool: "registrar_acompanhamento_visitante" };
  }
}
