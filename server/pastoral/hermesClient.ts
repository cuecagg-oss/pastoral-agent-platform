import { ENV } from "../_core/env";
import type { AgentGatewayRuntimeConfig } from "./gatewayConfig";

export type HermesFailureCode = "disabled" | "unconfigured" | "circuit_open" | "timeout" | "network_error" | "response_error";
export type HermesConnectionStatus = "disabled" | "unconfigured" | "unknown" | "connected" | "degraded" | "circuit_open";

export type HermesSanitizedStatus = {
  enabled: boolean;
  configured: boolean;
  connection: HermesConnectionStatus;
  model: string;
  timeoutMs: number;
  retries: number;
  latencyMs: number | null;
  lastFailure: HermesFailureCode | null;
};

type HermesProbeResult = {
  connected: boolean;
  attempts: number;
  latencyMs: number | null;
  failure: HermesFailureCode | null;
};

export type HermesAttempt = {
  attempt: number;
  success: boolean;
  latencyMs: number | null;
  failure: HermesFailureCode | null;
};

export class HermesUnavailableError extends Error {
  constructor(readonly failure: HermesFailureCode) {
    super(`Hermes indisponível: ${failure}`);
    this.name = "HermesUnavailableError";
  }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type AttemptListener = (attempt: HermesAttempt) => void | Promise<void>;

function responseContent(payload: unknown): { content: string; model: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as { content?: unknown; model?: unknown };
  if (typeof candidate.content !== "string" || !candidate.content.trim() || candidate.content.length > 4_000) return null;
  return { content: candidate.content.trim(), model: typeof candidate.model === "string" && candidate.model.trim() ? candidate.model.trim().slice(0, 160) : "hermes-configured" };
}

export class HermesClient {
  private failures = 0;
  private openUntil = 0;
  private latencyMs: number | null = null;
  private lastFailure: HermesFailureCode | null = null;
  private lastConnection: HermesConnectionStatus = "unknown";

  constructor(
    private readonly fetcher: FetchLike = fetch,
    private readonly now: () => number = Date.now,
    private readonly baseUrl = ENV.hermesBaseUrl,
    private readonly apiKey = ENV.hermesApiKey,
  ) {}

  getStatus(config: AgentGatewayRuntimeConfig): HermesSanitizedStatus {
    const base = config.hermes;
    if (!base.enabled) return { enabled: false, configured: base.configured, connection: "disabled", model: base.model, timeoutMs: base.timeoutMs, retries: base.retries, latencyMs: null, lastFailure: null };
    if (!base.configured) return { enabled: true, configured: false, connection: "unconfigured", model: base.model, timeoutMs: base.timeoutMs, retries: base.retries, latencyMs: null, lastFailure: "unconfigured" };
    if (this.now() < this.openUntil) return { enabled: true, configured: true, connection: "circuit_open", model: base.model, timeoutMs: base.timeoutMs, retries: base.retries, latencyMs: this.latencyMs, lastFailure: "circuit_open" };
    return { enabled: true, configured: true, connection: this.lastConnection, model: base.model, timeoutMs: base.timeoutMs, retries: base.retries, latencyMs: this.latencyMs, lastFailure: this.lastFailure };
  }

  async probe(config: AgentGatewayRuntimeConfig, onAttempt?: AttemptListener): Promise<HermesProbeResult> {
    const status = this.getStatus(config);
    if (status.connection === "disabled") return { connected: false, attempts: 0, latencyMs: null, failure: "disabled" };
    if (status.connection === "unconfigured") return { connected: false, attempts: 0, latencyMs: null, failure: "unconfigured" };
    if (status.connection === "circuit_open") return { connected: false, attempts: 0, latencyMs: status.latencyMs, failure: "circuit_open" };

    let lastFailure: HermesFailureCode = "network_error";
    const attempts = config.hermes.retries + 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const startedAt = this.now();
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), config.hermes.timeoutMs);
      try {
        const endpoint = new URL("health", this.baseUrl).toString();
        const response = await this.fetcher(endpoint, { method: "GET", headers: { Authorization: `Bearer ${this.apiKey}` }, signal: abort.signal });
        clearTimeout(timer);
        if (!response.ok) {
          lastFailure = "response_error";
          await onAttempt?.({ attempt, success: false, latencyMs: null, failure: lastFailure });
          continue;
        }
        this.latencyMs = Math.max(0, this.now() - startedAt);
        this.failures = 0;
        this.openUntil = 0;
        this.lastFailure = null;
        this.lastConnection = "connected";
        await onAttempt?.({ attempt, success: true, latencyMs: this.latencyMs, failure: null });
        return { connected: true, attempts: attempt, latencyMs: this.latencyMs, failure: null };
      } catch (error) {
        clearTimeout(timer);
        lastFailure = error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network_error";
        await onAttempt?.({ attempt, success: false, latencyMs: null, failure: lastFailure });
      }
    }

    this.failures += 1;
    this.lastFailure = lastFailure;
    this.lastConnection = "degraded";
    if (this.failures >= config.hermes.circuitFailureThreshold) this.openUntil = this.now() + config.hermes.circuitCooldownMs;
    return { connected: false, attempts, latencyMs: this.latencyMs, failure: lastFailure };
  }

  async generate(
    config: AgentGatewayRuntimeConfig,
    input: { requestId: string; system: string; user: string; fallback: string },
    onAttempt?: AttemptListener,
  ): Promise<{ content: string; provider: "hermes"; model: string }> {
    const status = this.getStatus(config);
    if (status.connection === "disabled") throw new HermesUnavailableError("disabled");
    if (status.connection === "unconfigured") throw new HermesUnavailableError("unconfigured");
    if (status.connection === "circuit_open") throw new HermesUnavailableError("circuit_open");

    let lastFailure: HermesFailureCode = "network_error";
    const attempts = config.hermes.retries + 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const startedAt = this.now();
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), config.hermes.timeoutMs);
      try {
        const endpoint = new URL("v1/agent/respond", this.baseUrl).toString();
        const response = await this.fetcher(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
          signal: abort.signal,
          body: JSON.stringify({ version: "v1", requestId: input.requestId, system: input.system, user: input.user, fallback: input.fallback }),
        });
        clearTimeout(timer);
        if (!response.ok) {
          lastFailure = "response_error";
          await onAttempt?.({ attempt, success: false, latencyMs: null, failure: lastFailure });
          continue;
        }
        const generated = responseContent(await response.json());
        if (!generated) {
          lastFailure = "response_error";
          await onAttempt?.({ attempt, success: false, latencyMs: null, failure: lastFailure });
          continue;
        }
        this.latencyMs = Math.max(0, this.now() - startedAt);
        this.failures = 0;
        this.openUntil = 0;
        this.lastFailure = null;
        this.lastConnection = "connected";
        await onAttempt?.({ attempt, success: true, latencyMs: this.latencyMs, failure: null });
        return { content: generated.content, provider: "hermes", model: generated.model };
      } catch (error) {
        clearTimeout(timer);
        lastFailure = error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network_error";
        await onAttempt?.({ attempt, success: false, latencyMs: null, failure: lastFailure });
      }
    }

    this.failures += 1;
    this.lastFailure = lastFailure;
    this.lastConnection = "degraded";
    if (this.failures >= config.hermes.circuitFailureThreshold) this.openUntil = this.now() + config.hermes.circuitCooldownMs;
    throw new HermesUnavailableError(lastFailure);
  }
}
