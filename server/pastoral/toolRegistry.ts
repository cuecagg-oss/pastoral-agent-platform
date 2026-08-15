import { assertToolExecutionPermission } from "./policy";
import { getToolCatalogEntry, pastoralToolCatalog } from "./toolCatalog";
import type { PastoralRepository, ReadPastoralToolName, TenantContext, ToolCatalogEntry, ToolResult } from "./types";

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function isOrganizationCountIntent(message: string) {
  const input = normalized(message);
  const asksForCount = /\b(quant[ao]s?|quantidade|numero|número|total)\b/.test(input);
  const mentionsOrganization = /\b(igreja|igrejas|organizacao|organizacoes)\b/.test(input);
  const mentionsPastoralMetric = /\b(celula|celulas|relatorio|relatorios|visitante|visitantes|lider|lideres|presenca|reuniao)\b/.test(input);

  // Church counts would cross the active tenant boundary. A question such as
  // "quantas igrejas" must not silently fall through to the default cell tool.
  return asksForCount && mentionsOrganization && !mentionsPastoralMetric;
}

export function chooseReadTool(message: string): ReadPastoralToolName {
  const input = normalized(message);
  if (input.includes("relatorio") || input.includes("entregaram")) return "consultar_relatorios";
  if (input.includes("presenca") || input.includes("reuniao") || input.includes("realizaram")) return "consultar_presenca";
  if (input.includes("visitante") || input.includes("acompanhamento")) return "consultar_visitantes";
  if (input.includes("lider") || input.includes("atencao")) return "consultar_lideres";
  return "consultar_celulas";
}

export function isFollowupIntent(message: string) {
  const input = normalized(message);
  return input.includes("registre") && (input.includes("contato") || input.includes("acompanhamento"));
}

export function extractVisitorName(message: string) {
  const match = message.match(/(?:com|a)\s+([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][A-Za-zÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç'-]+(?:\s+[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][A-Za-zÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç'-]+)?)/);
  return match?.[1]?.trim() ?? null;
}

export async function executeReadTool(
  repository: PastoralRepository,
  context: TenantContext,
  tool: ReadPastoralToolName,
  catalog: readonly ToolCatalogEntry[] = pastoralToolCatalog,
): Promise<ToolResult> {
  assertToolExecutionPermission(context, getToolCatalogEntry(tool, catalog));
  switch (tool) {
    case "consultar_celulas":
      return repository.queryCells(context);
    case "consultar_relatorios":
      return repository.queryReports(context);
    case "consultar_presenca":
      return repository.queryAttendance(context);
    case "consultar_visitantes":
      return repository.queryVisitors(context);
    case "consultar_lideres":
      return repository.queryLeaders(context);
  }
}
