import { describe, expect, it } from "vitest";
import { assertFollowupPermission, assertTenantScope, AuthorizationError, TenantIsolationError } from "./policy";
import type { TenantContext } from "./types";

const pastorA: TenantContext = { organizationId: 1, organizationName: "Igreja Demonstração A", userId: 10, userName: "Pastor A", role: "pastor" };

describe("política multi-tenant", () => {
  it("bloqueia recurso de outra organização", () => {
    expect(() => assertTenantScope(pastorA, 2)).toThrow(TenantIsolationError);
  });

  it("permite acompanhamento para pastor e bloqueia líder", () => {
    expect(() => assertFollowupPermission(pastorA)).not.toThrow();
    expect(() => assertFollowupPermission({ ...pastorA, role: "leader" })).toThrow(AuthorizationError);
  });
});
