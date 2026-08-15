import { TRPCError } from "@trpc/server";
import type { TenantContext, TenantRole } from "./types";

const writeRoles: TenantRole[] = ["admin", "pastor", "supervisor"];

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
