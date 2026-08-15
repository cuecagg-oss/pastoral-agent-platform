import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { auditLogs, conversationMessages, organizationAgentSettings, organizationMemberships, organizationToolSettings, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

function authenticatedContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "gEyVapiwVFwXMYksX5uKiD",
      name: "Reginaldo Medeiros",
      email: "cuecagg@gmail.com",
      loginMethod: "google",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("Consultas pastorais autenticadas", () => {
  it("resolve dashboard, cria conversa e lista mensagens somente no tenant da sessão", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    const dashboard = await caller.pastoral.dashboard();
    const conversation = await caller.pastoral.currentConversation();
    const messages = await caller.pastoral.messages({ conversationId: conversation.id });

    expect(dashboard.tenant).toMatchObject({ organizationId: 1, organizationName: "Igreja Demonstração A", userId: 1 });
    expect(dashboard.summary.cells).toBeGreaterThan(0);
    expect(conversation.organizationId).toBe(dashboard.tenant.organizationId);
    expect(Array.isArray(messages)).toBe(true);
  });

  it("impede que o tenant B leia a conversa e os dados do tenant A", async () => {
    const callerA = appRouter.createCaller(authenticatedContext());
    const conversationA = await callerA.pastoral.currentConversation();
    const db = await getDb();
    if (!db) throw new Error("Banco de teste indisponível.");
    await db.insert(conversationMessages).values({
      conversationId: conversationA.id,
      organizationId: 1,
      userId: 1,
      role: "user",
      messageType: "voice",
      content: "Mensagem de voz enviada.",
      model: "voice-input-v1",
    });
    const messagesA = await callerA.pastoral.messages({ conversationId: conversationA.id });
    const demoPastorA = (await db.select().from(users).where(eq(users.openId, "demo-pastor-a")).limit(1))[0];
    const demoPastorB = (await db.select().from(users).where(eq(users.openId, "demo-pastor-b")).limit(1))[0];
    if (!demoPastorA) throw new Error("Segundo usuário do tenant A não foi semeado.");
    if (!demoPastorB) throw new Error("Usuário do tenant B não foi semeado.");
    const callerSameChurch = appRouter.createCaller({
      ...authenticatedContext(),
      user: { ...authenticatedContext().user!, id: demoPastorA.id, openId: demoPastorA.openId, name: demoPastorA.name, role: "user" },
    });
    const callerB = appRouter.createCaller({
      ...authenticatedContext(),
      user: { ...authenticatedContext().user!, id: demoPastorB.id, openId: demoPastorB.openId, name: demoPastorB.name, role: "user" },
    });
    const dashboardB = await callerB.pastoral.dashboard();

    expect(dashboardB.tenant.organizationName).toBe("Igreja Demonstração B");
    expect(dashboardB.summary.cells).toBe(1);
    expect(messagesA).toContainEqual(expect.objectContaining({ role: "user", messageType: "voice", content: "Mensagem de voz enviada." }));
    await expect(callerSameChurch.pastoral.messages({ conversationId: conversationA.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerB.pastoral.messages({ conversationId: conversationA.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("persiste configuração do Gateway pelo admin, a resolve por tenant e nunca devolve segredos", async () => {
    const db = await getDb();
    if (!db) throw new Error("Banco de teste indisponível.");
    await db.update(organizationMemberships).set({ role: "admin" }).where(eq(organizationMemberships.userId, 1));
    const adminCaller = appRouter.createCaller(authenticatedContext());
    const demoPastorB = (await db.select().from(users).where(eq(users.openId, "demo-pastor-b")).limit(1))[0];
    if (!demoPastorB) throw new Error("Usuário do tenant B não foi semeado.");
    const callerB = appRouter.createCaller({
      ...authenticatedContext(),
      user: { ...authenticatedContext().user!, id: demoPastorB.id, openId: demoPastorB.openId, name: demoPastorB.name, role: "user" },
    });

    const updatedA = await adminCaller.pastoral.updateAgentSettings({
      enabled: true,
      provider: "legacy",
      model: "tenant-a-safe-model",
      fallbackPolicy: "deterministic",
    });
    await db.insert(organizationAgentSettings).values({
      organizationId: 2,
      enabled: false,
      provider: "hermes",
      model: "tenant-b-isolated-model",
      fallbackPolicy: "deterministic",
      updatedByUserId: demoPastorB.id,
    }).onDuplicateKeyUpdate({
      set: { enabled: false, provider: "hermes", model: "tenant-b-isolated-model", fallbackPolicy: "deterministic", updatedByUserId: demoPastorB.id, updatedAt: new Date() },
    });

    const resolvedA = await adminCaller.pastoral.agentSettings();
    const resolvedB = await callerB.pastoral.agentSettings();
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.action, "agent_gateway.settings.update"));

    expect(updatedA).toMatchObject({ status: "online", provider: "legacy", model: "tenant-a-safe-model", source: "organization" });
    expect(resolvedA).toMatchObject({ provider: "legacy", model: "tenant-a-safe-model", source: "organization" });
    expect(resolvedB).toMatchObject({ status: "disabled", provider: "hermes", model: "tenant-b-isolated-model", source: "organization" });
    expect(JSON.stringify(resolvedA)).not.toMatch(/key|token|url/i);
    expect(audits.some(entry => entry.organizationId === 1 && entry.userId === 1)).toBe(true);
    await expect(callerB.pastoral.updateAgentSettings({ enabled: true, provider: "legacy", model: "denied-model", fallbackPolicy: "deterministic" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("expõe o catálogo de ferramentas pelo tenant autenticado sem detalhes internos", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    const catalog = await caller.pastoral.toolCatalog();

    expect(catalog).toContainEqual(expect.objectContaining({ name: "consultar_celulas", category: "READ", enabled: true }));
    expect(catalog).toContainEqual(expect.objectContaining({ name: "registrar_acompanhamento_visitante", requiresConfirmation: true }));
    expect(JSON.stringify(catalog)).not.toMatch(/execute|repository|secret|token|key|url|organizationId/i);
  });

  it("persiste a habilitação somente para a organização do administrador e bloqueia mudanças por papéis não administrativos", async () => {
    const db = await getDb();
    if (!db) throw new Error("Banco de teste indisponível.");
    await db.update(organizationMemberships).set({ role: "admin" }).where(eq(organizationMemberships.userId, 1));
    const adminCaller = appRouter.createCaller(authenticatedContext());
    const demoPastorB = (await db.select().from(users).where(eq(users.openId, "demo-pastor-b")).limit(1))[0];
    if (!demoPastorB) throw new Error("Usuário do tenant B não foi semeado.");
    const callerB = appRouter.createCaller({
      ...authenticatedContext(),
      user: { ...authenticatedContext().user!, id: demoPastorB.id, openId: demoPastorB.openId, name: demoPastorB.name, role: "user" },
    });

    const updatedA = await adminCaller.pastoral.updateToolStatus({ name: "consultar_celulas", enabled: false });
    const catalogB = await callerB.pastoral.toolCatalog();
    const setting = (await db.select().from(organizationToolSettings).where(eq(organizationToolSettings.organizationId, 1)).limit(1))[0];
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.action, "agent_tool.settings.update"));

    expect(updatedA).toContainEqual(expect.objectContaining({ name: "consultar_celulas", enabled: false }));
    expect(catalogB).toContainEqual(expect.objectContaining({ name: "consultar_celulas", enabled: true }));
    expect(setting).toMatchObject({ organizationId: 1, toolName: "consultar_celulas", enabled: false, updatedByUserId: 1 });
    expect(audits.some(entry => entry.organizationId === 1 && entry.userId === 1 && entry.tool === "consultar_celulas")).toBe(true);
    await expect(callerB.pastoral.updateToolStatus({ name: "consultar_celulas", enabled: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
