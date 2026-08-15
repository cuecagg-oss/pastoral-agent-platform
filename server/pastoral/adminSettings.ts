import { desc, eq } from "drizzle-orm";
import { auditLogs, organizationMemberships, users } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { assertAdministrativePermission } from "./policy";
import type { TenantContext } from "./types";

function requireDb<T>(value: T | null): T {
  if (!value) throw new Error("Banco de dados indisponível. Tente novamente em instantes.");
  return value;
}

/**
 * Retorna somente dados operacionais necessários para a tela administrativa.
 * Segredos, metadados de auditoria livres e identificadores internos não saem
 * deste limite de servidor.
 */
export async function getAdminSettingsOverview(context: TenantContext) {
  assertAdministrativePermission(context);
  const db = requireDb(await getDb());

  const [memberships, auditEvents] = await Promise.all([
    db.select({
      name: users.name,
      email: users.email,
      role: organizationMemberships.role,
      joinedAt: organizationMemberships.createdAt,
    })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(eq(organizationMemberships.organizationId, context.organizationId))
      .orderBy(organizationMemberships.createdAt),
    db.select({
      actorName: users.name,
      action: auditLogs.action,
      agent: auditLogs.agent,
      model: auditLogs.model,
      provider: auditLogs.provider,
      tool: auditLogs.tool,
      requestId: auditLogs.requestId,
      result: auditLogs.result,
      confirmationStatus: auditLogs.confirmationStatus,
      status: auditLogs.status,
      createdAt: auditLogs.createdAt,
    })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.organizationId, context.organizationId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(30),
  ]);

  const voiceConfigured = Boolean(ENV.forgeApiUrl && ENV.forgeApiKey);

  return {
    organization: {
      name: context.organizationName,
      role: context.role,
    },
    users: memberships.map(member => ({
      name: member.name ?? "Usuário sem nome",
      email: member.email ?? "E-mail não informado",
      role: member.role,
      joinedAt: member.joinedAt,
    })),
    voice: {
      inputEnabled: voiceConfigured,
      provider: "Transcrição integrada",
      status: voiceConfigured ? "configured" : "unavailable",
      transcriptionVisibility: "A transcrição é processada internamente e não aparece no histórico.",
    },
    auditEvents: auditEvents.map(event => ({
      actorName: event.actorName ?? "Usuário removido",
      action: event.action,
      agent: event.agent,
      model: event.model,
      provider: event.provider,
      tool: event.tool,
      requestId: event.requestId,
      result: event.result,
      confirmationStatus: event.confirmationStatus,
      status: event.status,
      createdAt: event.createdAt,
    })),
  } as const;
}
