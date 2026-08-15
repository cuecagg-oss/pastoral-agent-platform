import type { PastoralToolName, TenantContext, ToolCatalogEntry } from "./types";

export const pastoralToolCatalog: readonly ToolCatalogEntry[] = [
  {
    name: "consultar_celulas",
    category: "READ",
    authorizedRoles: ["admin", "pastor", "supervisor", "leader"],
    requiresConfirmation: false,
    enabled: true,
    description: "Consulta células e o respectivo estado operacional da organização atual.",
  },
  {
    name: "consultar_relatorios",
    category: "READ",
    authorizedRoles: ["admin", "pastor", "supervisor", "leader"],
    requiresConfirmation: false,
    enabled: true,
    description: "Consulta relatórios pastorais autorizados da organização atual.",
  },
  {
    name: "consultar_presenca",
    category: "READ",
    authorizedRoles: ["admin", "pastor", "supervisor", "leader"],
    requiresConfirmation: false,
    enabled: true,
    description: "Consulta dados agregados de reuniões e presença da organização atual.",
  },
  {
    name: "consultar_visitantes",
    category: "SENSITIVE",
    authorizedRoles: ["admin", "pastor", "supervisor"],
    requiresConfirmation: false,
    enabled: true,
    description: "Consulta visitantes e acompanhamentos autorizados da organização atual.",
  },
  {
    name: "consultar_lideres",
    category: "SENSITIVE",
    authorizedRoles: ["admin", "pastor", "supervisor"],
    requiresConfirmation: false,
    enabled: true,
    description: "Consulta informações e alertas autorizados de liderança da organização atual.",
  },
  {
    name: "registrar_acompanhamento_visitante",
    category: "WRITE",
    authorizedRoles: ["admin", "pastor", "supervisor"],
    requiresConfirmation: true,
    enabled: true,
    description: "Prepara e registra um acompanhamento de visitante somente após confirmação explícita.",
  },
] as const;

export function getToolCatalogEntry(
  name: PastoralToolName,
  catalog: readonly ToolCatalogEntry[] = pastoralToolCatalog,
): ToolCatalogEntry {
  const entry = catalog.find(candidate => candidate.name === name);
  if (!entry) {
    throw new Error(`Ferramenta pastoral não catalogada: ${name}`);
  }
  return entry;
}

function toSanitizedEntry(entry: ToolCatalogEntry): ToolCatalogEntry {
  return {
    name: entry.name,
    category: entry.category,
    authorizedRoles: [...entry.authorizedRoles],
    requiresConfirmation: entry.requiresConfirmation,
    enabled: entry.enabled,
    description: entry.description,
  };
}

export function listSanitizedToolCatalog(
  context: TenantContext,
  catalog: readonly ToolCatalogEntry[] = pastoralToolCatalog,
): ToolCatalogEntry[] {
  const canReviewAllTools = context.role === "admin";
  return catalog
    .filter(entry => canReviewAllTools || entry.authorizedRoles.includes(context.role))
    .map(toSanitizedEntry);
}
