import { describe, expect, it, vi } from "vitest";
import { createThanosContext } from "../../thanos/context";
import { toDomain, toWorkspaceKey, tenantIdFromOrganizationId } from "../../thanos/contextIdentity";
import { pastoralSkillDefinition, pastoralWorkspaceDefinition } from "./workspaceDefinition";
import { createPastoralReadToolAdapter, PastoralSkillPolicyError } from "./pastoralToolAdapter";
import { pastoralToolCatalog } from "../../pastoral/toolCatalog";

const tenantContext = { organizationId: 1, userId: 2, userName: "Ana", role: "leader" as const };
const repository = { queryCells: vi.fn().mockResolvedValue([]) } as any;

function makeContext(channel: "chat" | "voice" = "chat") {
  return createThanosContext({
    workspaceKey: toWorkspaceKey("pastoral"), tenantId: tenantIdFromOrganizationId(1), domain: toDomain("pastoral"),
    userId: 2, userName: "Ana", role: "leader", capabilities: ["agent:read"], channel, requestId: "adapter-1",
  });
}

describe("adaptador de ferramentas do workspace Pastoral", () => {
  it("expõe somente uma ferramenta READ autorizada pela skill", async () => {
    const tool = createPastoralReadToolAdapter({ repository, tenantContext, thanosContext: makeContext(), skill: pastoralSkillDefinition, toolCatalog: pastoralToolCatalog, message: "quais células temos?" });
    expect(tool.name).toBe("consultar_celulas");
    expect(tool.requiredCapability).toBe("agent:read");
    await tool.execute();
    expect(repository.queryCells).toHaveBeenCalledWith(tenantContext);
  });

  it("nega canal fora do escopo da skill", () => {
    expect(() => createPastoralReadToolAdapter({ repository, tenantContext, thanosContext: makeContext("voice"), skill: pastoralSkillDefinition, toolCatalog: pastoralToolCatalog, message: "células" })).toThrow(PastoralSkillPolicyError);
  });

  it("nega capability incompatível antes de expor uma ferramenta", () => {
    const contextWithoutReadCapability = createThanosContext({
      workspaceKey: toWorkspaceKey("pastoral"), tenantId: tenantIdFromOrganizationId(1), domain: toDomain("pastoral"),
      userId: 2, userName: "Ana", role: "leader", capabilities: [], channel: "chat", requestId: "adapter-no-capability",
    });

    expect(() => createPastoralReadToolAdapter({ repository, tenantContext, thanosContext: contextWithoutReadCapability, skill: pastoralSkillDefinition, toolCatalog: pastoralToolCatalog, message: "células" })).toThrow(PastoralSkillPolicyError);
  });

  it("nega ferramenta sem autorização para o papel autenticado", () => {
    const userTenantContext = { ...tenantContext, role: "user" as const };
    const userContext = pastoralWorkspaceDefinition.resolveContext({ tenantContext: userTenantContext, channel: "chat" });
    const userCatalog = pastoralToolCatalog.filter(entry => entry.authorizedRoles.includes(userTenantContext.role));

    expect(() => createPastoralReadToolAdapter({ repository, tenantContext: userTenantContext, thanosContext: userContext, skill: pastoralSkillDefinition, toolCatalog: userCatalog, message: "células" })).toThrow(PastoralSkillPolicyError);
  });
});
