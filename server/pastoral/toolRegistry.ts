import type { PastoralRepository, PastoralToolName, TenantContext, ToolResult } from "./types";

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function chooseReadTool(message: string): PastoralToolName {
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
  tool: PastoralToolName,
): Promise<ToolResult> {
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
