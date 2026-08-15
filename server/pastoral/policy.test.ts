import { describe, expect, it } from "vitest";
import { assertDashboardPermission, assertFollowupPermission, assertTenantScope, AuthorizationError, TenantIsolationError } from "./policy";
import type { TenantContext } from "./types";

const pastorA: TenantContext = { organizationId: 1, organizationName: "Igreja Demonstração A", userId: 10, userName: "Pastor A", role: "pastor" };

describe("política multi-tenant", () => {
  it("bloqueia recurso de outra organização", () => {
    expect(() => assertTenantScope(pastorA, 2)).toThrow(TenantIsolationError);
  });

  it("permite acompanhamento para papéis responsáveis e bloqueia líder", () => {
    const expected: Array<[TenantContext["role"], boolean]> = [
      ["admin", true],
      ["pastor", true],
      ["supervisor", true],
      ["leader", false],
    ];

    for (const [role, allowed] of expected) {
      const attempt = () => assertFollowupPermission({ ...pastorA, role });
      if (allowed) expect(attempt).not.toThrow();
      else expect(attempt).toThrow(AuthorizationError);
    }
  });

  it("autoriza a visão agregada do Dashboard a todos os papéis de membership", () => {
    for (const role of ["admin", "pastor", "supervisor", "leader"] as const) {
      expect(() => assertDashboardPermission({ ...pastorA, role })).not.toThrow();
    }
  });
});
