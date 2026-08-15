import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { users } from "../../drizzle/schema";
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
    const demoPastorB = (await db.select().from(users).where(eq(users.openId, "demo-pastor-b")).limit(1))[0];
    if (!demoPastorB) throw new Error("Usuário do tenant B não foi semeado.");
    const callerB = appRouter.createCaller({
      ...authenticatedContext(),
      user: { ...authenticatedContext().user!, id: demoPastorB.id, openId: demoPastorB.openId, name: demoPastorB.name, role: "user" },
    });
    const dashboardB = await callerB.pastoral.dashboard();

    expect(dashboardB.tenant.organizationName).toBe("Igreja Demonstração B");
    expect(dashboardB.summary.cells).toBe(1);
    await expect(callerB.pastoral.messages({ conversationId: conversationA.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
