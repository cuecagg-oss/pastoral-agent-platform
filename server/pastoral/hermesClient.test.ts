import { describe, expect, it } from "vitest";
import { HermesClient } from "./hermesClient";

const config = {
  enabled: true,
  provider: "hermes" as const,
  model: "hermes-pilot",
  hermes: { enabled: true, configured: true, model: "hermes-pilot", timeoutMs: 25, retries: 1, circuitFailureThreshold: 2, circuitCooldownMs: 100 },
};

describe("cliente Hermes resiliente", () => {
  it("tenta novamente uma falha transitória e mantém apenas estado sanitizado", async () => {
    let calls = 0;
    const client = new HermesClient(async () => {
      calls += 1;
      if (calls === 1) throw new Error("offline");
      return new Response(null, { status: 204 });
    }, () => 100, "https://hermes.example/", "secret-not-returned");

    const result = await client.probe(config);
    const status = client.getStatus(config);

    expect(result).toEqual({ connected: true, attempts: 2, latencyMs: 0, failure: null });
    expect(status).toMatchObject({ connection: "connected", retries: 1, lastFailure: null });
    expect(JSON.stringify(status)).not.toMatch(/secret|example|url|key|token/i);
  });

  it("abre o circuito após falhas consecutivas e evita novas chamadas até o cooldown", async () => {
    let calls = 0;
    let clock = 100;
    const client = new HermesClient(async () => {
      calls += 1;
      throw new Error("offline");
    }, () => clock, "https://hermes.example/", "secret-not-returned");
    const noRetryConfig = { ...config, hermes: { ...config.hermes, retries: 0 } };

    await client.probe(noRetryConfig);
    await client.probe(noRetryConfig);
    const blocked = await client.probe(noRetryConfig);

    expect(blocked).toMatchObject({ connected: false, attempts: 0, failure: "circuit_open" });
    expect(calls).toBe(2);
    clock += 101;
    expect(client.getStatus(noRetryConfig).connection).toBe("degraded");
  });
});
