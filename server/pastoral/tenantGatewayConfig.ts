import { eq } from "drizzle-orm";
import { organizationAgentSettings } from "../../drizzle/schema";
import { getDb } from "../db";
import { getAgentGatewayRuntimeConfig, type AgentGatewayRuntimeConfig } from "./gatewayConfig";
import { assertAdministrativePermission } from "./policy";
import type { TenantContext } from "./types";

export type TenantGatewayConfig = AgentGatewayRuntimeConfig & {
  fallbackPolicy: "deterministic";
  source: "environment" | "organization";
};

type StoredGatewaySettings = Pick<typeof organizationAgentSettings.$inferSelect, "enabled" | "provider" | "model" | "fallbackPolicy">;

export type TenantGatewayConfigUpdate = {
  enabled: boolean;
  provider: "legacy" | "hermes";
  model: string;
  fallbackPolicy: "deterministic";
};

export function resolveTenantGatewaySettings(base: AgentGatewayRuntimeConfig, stored?: StoredGatewaySettings): TenantGatewayConfig {
  if (!stored) return { ...base, fallbackPolicy: "deterministic", source: "environment" };
  return {
    ...base,
    enabled: stored.enabled,
    provider: stored.provider,
    model: stored.model || base.model,
    fallbackPolicy: stored.fallbackPolicy,
    source: "organization",
  };
}

export async function getTenantGatewayConfig(context: TenantContext): Promise<TenantGatewayConfig> {
  const base = getAgentGatewayRuntimeConfig();
  const db = await getDb();
  if (!db) return resolveTenantGatewaySettings(base);
  const rows = await db.select({
    enabled: organizationAgentSettings.enabled,
    provider: organizationAgentSettings.provider,
    model: organizationAgentSettings.model,
    fallbackPolicy: organizationAgentSettings.fallbackPolicy,
  }).from(organizationAgentSettings).where(eq(organizationAgentSettings.organizationId, context.organizationId)).limit(1);
  return resolveTenantGatewaySettings(base, rows[0]);
}

export async function updateTenantGatewayConfig(context: TenantContext, input: TenantGatewayConfigUpdate): Promise<TenantGatewayConfig> {
  assertAdministrativePermission(context);
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível. Tente novamente em instantes.");

  await db.insert(organizationAgentSettings).values({
    organizationId: context.organizationId,
    enabled: input.enabled,
    provider: input.provider,
    model: input.model,
    fallbackPolicy: input.fallbackPolicy,
    updatedByUserId: context.userId,
  }).onDuplicateKeyUpdate({
    set: {
      enabled: input.enabled,
      provider: input.provider,
      model: input.model,
      fallbackPolicy: input.fallbackPolicy,
      updatedByUserId: context.userId,
      updatedAt: new Date(),
    },
  });

  return getTenantGatewayConfig(context);
}

export function toSanitizedTenantGatewayStatus(config: TenantGatewayConfig) {
  return {
    status: config.enabled ? "online" : "disabled",
    provider: config.provider,
    model: config.model,
    fallbackPolicy: config.fallbackPolicy,
    source: config.source,
    hermes: {
      enabled: config.hermes.enabled,
      configured: config.hermes.configured,
      model: config.hermes.model,
      timeoutMs: config.hermes.timeoutMs,
    },
  } as const;
}
