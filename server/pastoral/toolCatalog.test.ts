import { describe, expect, it } from "vitest";
import { listSanitizedToolCatalog, pastoralToolCatalog } from "./toolCatalog";
import type { TenantContext } from "./types";

const adminContext: TenantContext = {
  organizationId: 1,
  organizationName: "Igreja Demonstração A",
  userId: 1,
  userName: "Admin",
  role: "admin",
};

describe("Catálogo declarativo de ferramentas pastorais", () => {
  it("declara todas as ferramentas piloto com metadados de autorização e confirmação", () => {
    expect(pastoralToolCatalog).toHaveLength(6);
    expect(pastoralToolCatalog).toContainEqual(expect.objectContaining({
      name: "registrar_acompanhamento_visitante",
      category: "WRITE",
      requiresConfirmation: true,
      enabled: true,
    }));
    expect(pastoralToolCatalog).toContainEqual(expect.objectContaining({ name: "consultar_visitantes", category: "SENSITIVE" }));
  });

  it("retorna somente ferramentas autorizadas para papéis não administrativos e sem detalhes internos", () => {
    const leaderCatalog = listSanitizedToolCatalog({ ...adminContext, role: "leader" });

    expect(leaderCatalog.map(entry => entry.name)).not.toContain("consultar_visitantes");
    expect(leaderCatalog.map(entry => entry.name)).not.toContain("registrar_acompanhamento_visitante");
    expect(JSON.stringify(leaderCatalog)).not.toMatch(/execute|repository|secret|token|key|url/i);
  });

  it("devolve cópias sanitizadas sem mutar o catálogo declarativo", () => {
    const response = listSanitizedToolCatalog(adminContext);
    response[0].authorizedRoles = [];

    expect(pastoralToolCatalog[0].authorizedRoles).not.toEqual([]);
  });
});
