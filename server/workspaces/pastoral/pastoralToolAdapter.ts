import type { SkillDefinition, ThanosContext } from "../../thanos/contracts";
import type { ThanosReadTool } from "../../thanos/orchestrator";
import { chooseReadTool, executeReadTool } from "../../pastoral/toolRegistry";
import type { PastoralRepository, TenantContext, ToolCatalogEntry } from "../../pastoral/types";

export class PastoralSkillPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PastoralSkillPolicyError";
  }
}

function assertPastoralReadSkill(input: Readonly<{ skill: SkillDefinition; context: ThanosContext }>) {
  if (!input.skill.readOnly) {
    throw new PastoralSkillPolicyError("A skill THÁNOS Pastoral deve operar somente em leitura.");
  }
  if (!input.skill.allowedChannels.includes(input.context.channel)) {
    throw new PastoralSkillPolicyError("O canal solicitado não é permitido para esta skill.");
  }
  for (const capability of input.skill.requiredCapabilities) {
    if (!input.context.capabilities.includes(capability)) {
      throw new PastoralSkillPolicyError("O contexto não possui a capability exigida pela skill.");
    }
  }
}

export function createPastoralReadToolAdapter(input: Readonly<{
  repository: PastoralRepository;
  tenantContext: TenantContext;
  thanosContext: ThanosContext;
  skill: SkillDefinition;
  toolCatalog: readonly ToolCatalogEntry[];
  message: string;
}>): ThanosReadTool {
  assertPastoralReadSkill({ skill: input.skill, context: input.thanosContext });
  const tool = chooseReadTool(input.message);
  if (!input.skill.allowedTools.includes(tool)) {
    throw new PastoralSkillPolicyError("A ferramenta selecionada não é autorizada pela skill atual.");
  }
  const catalogEntry = input.toolCatalog.find(entry => entry.name === tool);
  if (!catalogEntry || catalogEntry.category !== "READ") {
    throw new PastoralSkillPolicyError("A ferramenta selecionada não está disponível em modo somente leitura.");
  }
  return Object.freeze({
    name: tool,
    requiredCapability: "agent:read",
    execute: async () => executeReadTool(input.repository, input.tenantContext, tool, input.toolCatalog),
  });
}
