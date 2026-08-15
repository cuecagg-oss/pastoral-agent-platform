import type { Domain, TenantId, ThanosContextIdentity, WorkspaceKey } from "./contextIdentity";

export type ThanosCapability = "agent:read" | "agent:write" | "dashboard:read" | "settings:manage";
export type ThanosChannel = "chat" | "voice";

export type ThanosContext = Readonly<
  ThanosContextIdentity & {
    userId: number;
    userName: string;
    role: string;
    capabilities: readonly ThanosCapability[];
    channel: ThanosChannel;
    conversationId?: number;
    requestId: string;
  }
>;

export type WorkspaceDefinition<TSourceContext> = Readonly<{
  workspaceKey: WorkspaceKey;
  domain: Domain;
  displayName: string;
  resolveContext(source: TSourceContext): ThanosContext;
}>;

export type SkillDefinition = Readonly<{
  key: string;
  workspaceKey: WorkspaceKey;
  domain: Domain;
  description: string;
  allowedTools: readonly string[];
}>;

export type WorkspaceRegistration<TSourceContext> = WorkspaceDefinition<TSourceContext>;

export type ResolvedWorkspace = Readonly<{
  workspaceKey: WorkspaceKey;
  domain: Domain;
}>;

export type ContextIdentityFields = Readonly<{
  workspaceKey: WorkspaceKey;
  tenantId: TenantId;
  domain: Domain;
}>;
