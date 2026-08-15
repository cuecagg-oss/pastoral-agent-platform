import type { SkillDefinition, ThanosContext } from "../../thanos/contracts";
import type { ThanosReadTool } from "../../thanos/orchestrator";
import { chooseReadTool, executeReadTool } from "../../pastoral/toolRegistry";
import type { PastoralRepository, PastoralToolName, ReadPastoralToolName, TenantContext, ToolCatalogEntry } from "../../pastoral/types";

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
  return createPastoralDeclaredReadToolAdapter({ ...input, tool: chooseReadTool(input.message) });
}

export function createPastoralDeclaredReadToolAdapter(input: Readonly<{
  repository: PastoralRepository;
  tenantContext: TenantContext;
  thanosContext: ThanosContext;
  skill: SkillDefinition;
  toolCatalog: readonly ToolCatalogEntry[];
  tool: Exclude<PastoralToolName, "registrar_acompanhamento_visitante">;
}>): ThanosReadTool {
  assertPastoralReadSkill({ skill: input.skill, context: input.thanosContext });
  if (!input.skill.allowedTools.includes(input.tool)) {
    throw new PastoralSkillPolicyError("A ferramenta selecionada não é autorizada pela skill atual.");
  }
  const catalogEntry = input.toolCatalog.find(entry => entry.name === input.tool);
  if (!catalogEntry || catalogEntry.category !== "READ") {
    throw new PastoralSkillPolicyError("A ferramenta selecionada não está disponível em modo somente leitura.");
  }
  return Object.freeze({
    name: input.tool,
    requiredCapability: "agent:read",
    execute: async () => executeReadTool(input.repository, input.tenantContext, input.tool, input.toolCatalog),
  });
}

/** Plano fechado do piloto: duas ou três consultas READ com o mesmo tenant autenticado. */
export function createPastoralMultiStepReadAdapters(input: Readonly<{
  repository: PastoralRepository;
  tenantContext: TenantContext;
  thanosContext: ThanosContext;
  skill: SkillDefinition;
  toolCatalog: readonly ToolCatalogEntry[];
  tools?: readonly ReadPastoralToolName[];
}>): readonly ThanosReadTool[] {
  const tools = input.tools ?? ["consultar_celulas", "consultar_presenca"];
  return Object.freeze(tools.map(tool => createPastoralDeclaredReadToolAdapter({ ...input, tool })));
}
