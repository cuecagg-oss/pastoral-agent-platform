import { afterEach, describe, expect, it, vi } from "vitest";
import type { TenantContext } from "./types";

const envKeys = [
  "THANOS_PILOT_ENABLED",
  "THANOS_PILOT_KILL_SWITCH",
  "THANOS_PILOT_ORGANIZATION_IDS",
  "THANOS_PILOT_USER_IDS",
  "THANOS_PILOT_VERSION",
] as const;

const originalEnvironment = Object.fromEntries(envKeys.map(key => [key, process.env[key]])) as Record<(typeof envKeys)[number], string | undefined>;

const context: TenantContext = {
  organizationId: 1,
  organizationName: "Igreja Demonstração A",
  userId: 7,
  userName: "Pessoa Operacional",
  role: "pastor",
};

function restoreEnvironment() {
  for (const key of envKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
}

afterEach(() => restoreEnvironment());

describe("rollback operacional do piloto THÁNOS", () => {
  it("lê flags reais do processo, atende a audiência elegível, aplica kill switch e restaura o estado anterior", async () => {
    process.env.THANOS_PILOT_ENABLED = "true";
    process.env.THANOS_PILOT_KILL_SWITCH = "false";
    process.env.THANOS_PILOT_ORGANIZATION_IDS = "1";
    process.env.THANOS_PILOT_USER_IDS = "7";
    process.env.THANOS_PILOT_VERSION = "thanos-operational-proof-v1";
    vi.resetModules();

    const { getThanosPilotRuntimeConfig } = await import("./thanosPilotConfig");
    const { ThanosPilotRouter } = await import("./thanosPilotRouter");
    const repository = { appendMessage: vi.fn().mockResolvedValue(undefined), audit: vi.fn().mockResolvedValue(undefined) } as any;
    const legacy = { respond: vi.fn().mockResolvedValue({ content: "Resposta legado", provider: "legacy", model: "legacy-v1", requestId: "rollback-active" }) };
    const thanos = {
      respondRead: vi.fn(),
      respondMultiRead: vi.fn().mockResolvedValue({ content: "Resposta THÁNOS", provider: "deterministic", model: "rules-v1", requestId: "rollback-active", tool: "consultar_celulas,consultar_presenca,consultar_relatorios" }),
    };
    const activeConfig = getThanosPilotRuntimeConfig();
    const activeRouter = new ThanosPilotRouter(repository, legacy, thanos);

    const activeResponse = await activeRouter.respond({
      context,
      conversationId: 51,
      message: "Resumo de células, presença e relatórios",
      requestId: "rollback-active",
    });

    expect(activeConfig).toMatchObject({ enabled: true, killSwitch: false, organizationIds: [1], userIds: [7], version: "thanos-operational-proof-v1" });
    expect(activeResponse.thanos).toMatchObject({ version: "thanos-operational-proof-v1", fallback: false });
    expect(thanos.respondMultiRead).toHaveBeenCalledWith(expect.objectContaining({ tools: ["consultar_celulas", "consultar_presenca", "consultar_relatorios"] }));
    expect(legacy.respond).not.toHaveBeenCalled();

    process.env.THANOS_PILOT_KILL_SWITCH = "true";
    vi.resetModules();
    const { getThanosPilotRuntimeConfig: getKillSwitchConfig } = await import("./thanosPilotConfig");
    const { ThanosPilotRouter: KillSwitchRouter } = await import("./thanosPilotRouter");
    const killSwitchConfig = getKillSwitchConfig();
    const killSwitchRouter = new KillSwitchRouter(repository, legacy, thanos);

    const rollbackResponse = await killSwitchRouter.respond({
      context,
      conversationId: 52,
      message: "Resumo de células, presença e relatórios",
      requestId: "rollback-kill-switch",
    });

    expect(killSwitchConfig).toMatchObject({ enabled: true, killSwitch: true, version: "thanos-operational-proof-v1" });
    expect(rollbackResponse.thanos).toBeUndefined();
    expect(legacy.respond).toHaveBeenCalledWith(expect.objectContaining({ requestId: "rollback-kill-switch" }));
    expect(thanos.respondMultiRead).toHaveBeenCalledTimes(1);
    expect(repository.audit).toHaveBeenCalledWith(expect.objectContaining({
      requestId: "rollback-kill-switch",
      result: "legacy_kill_switch",
      metadata: expect.objectContaining({ route: "legacy", decision: "kill_switch", version: "thanos-operational-proof-v1" }),
    }));

    restoreEnvironment();
    expect(Object.fromEntries(envKeys.map(key => [key, process.env[key]]))).toEqual(originalEnvironment);
  });
});
