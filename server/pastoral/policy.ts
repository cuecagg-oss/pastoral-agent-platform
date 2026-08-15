import { TRPCError } from "@trpc/server";
import type { TenantContext, TenantRole, ToolCatalogEntry } from "./types";

const writeRoles: TenantRole[] = ["admin", "pastor", "supervisor"];
const administrativeRoles: TenantRole[] = ["admin"];

export class TenantIsolationError extends TRPCError {
  constructor() {
    super({ code: "FORBIDDEN", message: "Acesso negado: o recurso não pertence à organização autenticada." });
    this.name = "TenantIsolationError";
  }
}

export class AuthorizationError extends TRPCError {
  constructor() {
    super({ code: "FORBIDDEN", message: "Acesso negado: sua função não possui permissão para esta ação." });
    this.name = "AuthorizationError";
  }
}

export class ToolUnavailableError extends TRPCError {
  constructor() {
    super({ code: "FORBIDDEN", message: "Esta funcionalidade está desabilitada para sua organização." });
    this.name = "ToolUnavailableError";
  }
}

export function assertTenantScope(context: TenantContext, resourceOrganizationId: number) {
  if (context.organizationId !== resourceOrganizationId) {
    throw new TenantIsolationError();
  }
}

export function assertFollowupPermission(context: TenantContext) {
  if (!writeRoles.includes(context.role)) {
    throw new AuthorizationError();
  }
}

export function assertToolExecutionPermission(context: TenantContext, tool: ToolCatalogEntry) {
  if (!tool.enabled) {
    throw new ToolUnavailableError();
  }
  if (!tool.authorizedRoles.includes(context.role)) {
    throw new AuthorizationError();
  }
}

export function assertAdministrativePermission(context: TenantContext) {
  if (!administrativeRoles.includes(context.role)) {
    throw new AuthorizationError();
  }
}
