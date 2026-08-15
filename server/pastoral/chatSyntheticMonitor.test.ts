import { describe, expect, it, vi } from "vitest";
import {
  createSyntheticChatMonitorHandler,
  executeSyntheticChatCheck,
  isValidSyntheticChatResponse,
} from "./chatSyntheticMonitor";
import type { TenantContext } from "./types";

const contextA: TenantContext = { organizationId: 11, organizationName: "Igreja A", userId: 101, userName: "Monitor A", role: "pastor" };
const contextB: TenantContext = { organizationId: 22, organizationName: "Igreja B", userId: 202, userName: "Monitor B", role: "pastor" };

describe("monitor sintético do chat", () => {
  it("classifica uma resposta autorizada de células como saudável", async () => {
    const outcome = await executeSyntheticChatCheck(contextA, async input => {
      expect(input.context.organizationId).toBe(contextA.organizationId);
      return { tool: "consultar_celulas", content: "A Igreja A possui duas células ativas." };
    }, "request-a", () => 100);

    expect(outcome).toMatchObject({ status: "healthy", responseValid: true, reason: null });
  });

  it("reprova resposta curta, vazia ou com ferramenta divergente", async () => {
    expect(isValidSyntheticChatResponse("   ")).toBe(false);
    const outcome = await executeSyntheticChatCheck(contextA, async () => ({ tool: "consultar_presenca", content: "Resposta suficientemente extensa." }), "request-invalid");

    expect(outcome).toMatchObject({ status: "unhealthy", responseValid: false, reason: "invalid_response" });
  });

  it("preserva o contexto do tenant e registra falha sem expor conteúdo", async () => {
    const observed: number[] = [];
    const responder = async (input: { context: TenantContext }) => {
      observed.push(input.context.organizationId);
      if (input.context.organizationId === contextB.organizationId) throw new Error("indisponível");
      return { tool: "consultar_celulas", content: "Resposta autorizada para a organização atual." };
    };

    const [first, second] = await Promise.all([
      executeSyntheticChatCheck(contextA, responder, "request-a"),
      executeSyntheticChatCheck(contextB, responder, "request-b"),
    ]);

    expect(observed.sort()).toEqual([contextA.organizationId, contextB.organizationId]);
    expect(first.status).toBe("healthy");
    expect(second).toMatchObject({ status: "unhealthy", responseValid: false, reason: "response_execution_failed" });
  });

  it("bloqueia chamadas que não sejam da tarefa cron autenticada", async () => {
    const run = vi.fn();
    const handler = createSyntheticChatMonitorHandler({
      authenticateRequest: vi.fn().mockResolvedValue({ isCron: false }),
      run,
    });
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();

    await handler({ headers: {} } as any, { status, json } as any);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: "cron_only" });
    expect(run).not.toHaveBeenCalled();
  });
});
