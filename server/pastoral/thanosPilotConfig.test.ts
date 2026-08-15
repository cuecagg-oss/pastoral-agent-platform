import { describe, expect, it } from "vitest";
import { decideThanosPilotRoute, resolveThanosPilotRuntimeConfig } from "./thanosPilotConfig";
import type { TenantContext } from "./types";

const context: TenantContext = { organizationId: 1, organizationName: "Igreja A", userId: 10, userName: "Ana", role: "pastor" };

function config(overrides: Partial<Parameters<typeof resolveThanosPilotRuntimeConfig>[0]> = {}) {
  return resolveThanosPilotRuntimeConfig({ enabled: "true", killSwitch: "false", organizationIds: "1", userIds: "10", version: "thanos-read-pilot-v1", ...overrides });
}

describe("Thanos pilot routing", () => {
  it("mantém o piloto inativo por padrão e exige uma audiência explícita", () => {
    expect(decideThanosPilotRoute({ context, message: "Quais células temos?", config: config({ enabled: "false" }) })).toMatchObject({ route: "legacy", reason: "pilot_disabled" });
    expect(decideThanosPilotRoute({ context, message: "Quais células temos?", config: config({ organizationIds: "", userIds: "" }) })).toMatchObject({ route: "legacy", reason: "pilot_audience_missing" });
  });

  it("aplica kill switch e allowlists de tenant e usuário sem expor os identificadores", () => {
    expect(decideThanosPilotRoute({ context, message: "Quais células temos?", config: config({ killSwitch: "true" }) })).toMatchObject({ route: "legacy", reason: "kill_switch" });
    expect(decideThanosPilotRoute({ context: { ...context, organizationId: 2 }, message: "Quais células temos?", config: config() })).toMatchObject({ route: "legacy", reason: "organization_not_piloted" });
    expect(decideThanosPilotRoute({ context: { ...context, userId: 11 }, message: "Quais células temos?", config: config() })).toMatchObject({ route: "legacy", reason: "user_not_piloted" });
  });

  it("aceita somente intenções READ fechadas e escolhe planos de duas ou três etapas", () => {
    expect(decideThanosPilotRoute({ context, message: "Quais células temos?", config: config() })).toMatchObject({ route: "thanos", mode: "single_read", tools: ["consultar_celulas"] });
    expect(decideThanosPilotRoute({ context, message: "Mostre um resumo de células e presença", config: config() })).toMatchObject({ route: "thanos", mode: "multi_read", tools: ["consultar_celulas", "consultar_presenca"] });
    expect(decideThanosPilotRoute({ context, message: "Mostre um resumo de células, presença e relatórios", config: config() })).toMatchObject({ route: "thanos", mode: "multi_read", tools: ["consultar_celulas", "consultar_presenca", "consultar_relatorios"] });
    expect(decideThanosPilotRoute({ context, message: "Registre acompanhamento para Ana", config: config() })).toMatchObject({ route: "legacy", reason: "intent_not_eligible" });
    expect(decideThanosPilotRoute({ context, message: "Quantas igrejas existem?", config: config() })).toMatchObject({ route: "legacy", reason: "intent_not_eligible" });
  });
});
