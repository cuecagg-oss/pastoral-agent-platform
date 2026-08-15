import { eq } from "drizzle-orm";
import { organizationToolSettings } from "../../drizzle/schema";
import { getDb } from "../db";
import { assertAdministrativePermission } from "./policy";
import { getToolCatalogEntry, pastoralToolCatalog } from "./toolCatalog";
import type { PastoralToolName, TenantContext, ToolCatalogEntry } from "./types";

export type TenantToolStatusUpdate = {
  name: PastoralToolName;
  enabled: boolean;
};

export function resolveTenantToolCatalog(
  stored: ReadonlyMap<PastoralToolName, boolean>,
  catalog: readonly ToolCatalogEntry[] = pastoralToolCatalog,
): ToolCatalogEntry[] {
  return catalog.map(entry => ({
    ...entry,
    authorizedRoles: [...entry.authorizedRoles],
    enabled: stored.get(entry.name) ?? entry.enabled,
  }));
}

export async function getTenantToolCatalog(context: TenantContext): Promise<ToolCatalogEntry[]> {
  const db = await getDb();
  if (!db) return resolveTenantToolCatalog(new Map());
  const rows = await db.select({
    toolName: organizationToolSettings.toolName,
    enabled: organizationToolSettings.enabled,
  }).from(organizationToolSettings).where(eq(organizationToolSettings.organizationId, context.organizationId));
  const stored = new Map<PastoralToolName, boolean>();
  for (const row of rows) {
    if (pastoralToolCatalog.some(entry => entry.name === row.toolName)) {
      stored.set(row.toolName as PastoralToolName, row.enabled);
    }
  }
  return resolveTenantToolCatalog(stored);
}

export async function updateTenantToolStatus(
  context: TenantContext,
  input: TenantToolStatusUpdate,
): Promise<ToolCatalogEntry[]> {
  assertAdministrativePermission(context);
  getToolCatalogEntry(input.name);
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível. Tente novamente em instantes.");

  await db.insert(organizationToolSettings).values({
    organizationId: context.organizationId,
    toolName: input.name,
    enabled: input.enabled,
    updatedByUserId: context.userId,
  }).onDuplicateKeyUpdate({
    set: {
      enabled: input.enabled,
      updatedByUserId: context.userId,
      updatedAt: new Date(),
    },
  });

  return getTenantToolCatalog(context);
}
