import { describe, expect, it } from "vitest";
import { resolveTenantToolCatalog } from "./tenantToolConfig";

describe("Configuração de ferramentas por organização", () => {
  it("aplica somente overrides conhecidos sem alterar o catálogo global", () => {
    const catalog = resolveTenantToolCatalog(new Map([["consultar_celulas", false]]));

    expect(catalog).toContainEqual(expect.objectContaining({ name: "consultar_celulas", enabled: false }));
    expect(catalog).toContainEqual(expect.objectContaining({ name: "consultar_relatorios", enabled: true }));
  });
});
