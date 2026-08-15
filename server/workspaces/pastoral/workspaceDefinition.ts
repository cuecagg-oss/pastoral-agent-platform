import { randomUUID } from "node:crypto";
import { createThanosContext } from "../../thanos/context";
import type { SkillDefinition, ThanosCapability, ThanosChannel, WorkspaceDefinition } from "../../thanos/contracts";
import { tenantIdFromOrganizationId, toDomain, toWorkspaceKey } from "../../thanos/contextIdentity";
import type { TenantContext, TenantRole } from "../../pastoral/types";

export type PastoralWorkspaceSource = Readonly<{
  tenantContext: TenantContext;
  channel: ThanosChannel;
  conversationId?: number;
  serverRequestId?: string;
}>;

const pastoralWorkspaceKey = toWorkspaceKey("pastoral");
const pastoralDomain = toDomain("pastoral");

function capabilitiesForPastoralRole(role: TenantRole): readonly ThanosCapability[] {
  const capabilities: ThanosCapability[] = ["agent:read", "dashboard:read"];
  if (role === "admin" || role === "pastor" || role === "supervisor") {
    capabilities.push("agent:write");
  }
  if (role === "admin") {
    capabilities.push("settings:manage");
  }
  return Object.freeze(capabilities);
}

export const pastoralWorkspaceDefinition: WorkspaceDefinition<PastoralWorkspaceSource> = Object.freeze({
  workspaceKey: pastoralWorkspaceKey,
  domain: pastoralDomain,
  displayName: "Assistente Pastoral",
  resolveContext(source) {
    const { tenantContext } = source;
    return createThanosContext({
      workspaceKey: pastoralWorkspaceKey,
      tenantId: tenantIdFromOrganizationId(tenantContext.organizationId),
      domain: pastoralDomain,
      userId: tenantContext.userId,
      userName: tenantContext.userName,
      role: tenantContext.role,
      capabilities: capabilitiesForPastoralRole(tenantContext.role),
      channel: source.channel,
      ...(source.conversationId === undefined ? {} : { conversationId: source.conversationId }),
      requestId: source.serverRequestId ?? randomUUID(),
    });
  },
});

export const pastoralSkillDefinition: SkillDefinition = Object.freeze({
  key: "pastoral-assistant",
  workspaceKey: pastoralWorkspaceKey,
  domain: pastoralDomain,
  description: "Skill autorizada para consultas e acompanhamentos pastorais.",
  allowedTools: Object.freeze([
    "consultar_celulas",
    "consultar_relatorios",
    "consultar_presenca",
    "consultar_visitantes",
    "consultar_lideres",
    "registrar_acompanhamento_visitante",
  ]),
});

export const pastoralWorkspaceIdentity = Object.freeze({ workspaceKey: pastoralWorkspaceKey, domain: pastoralDomain });
