import { ENV } from "../_core/env";

export type AgentGatewayRuntimeConfig = {
  enabled: boolean;
  provider: "legacy" | "hermes";
  model: string;
  hermes: {
    enabled: boolean;
    configured: boolean;
    model: string;
    timeoutMs: number;
  };
};

function enabled(value: string, defaultValue: boolean) {
  if (!value) return defaultValue;
  return !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}

function positiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAgentGatewayRuntimeConfig(): AgentGatewayRuntimeConfig {
  const provider = ENV.agentGatewayProvider.trim().toLowerCase() === "hermes" ? "hermes" : "legacy";
  const hermesEnabled = enabled(ENV.hermesEnabled, false);
  return {
    enabled: enabled(ENV.agentGatewayEnabled, true),
    provider,
    model: ENV.agentGatewayModel.trim() || "legacy-router",
    hermes: {
      enabled: hermesEnabled,
      configured: Boolean(ENV.hermesBaseUrl && ENV.hermesApiKey),
      model: ENV.hermesModel.trim() || "hermes-default",
      timeoutMs: Math.min(15_000, positiveInteger(ENV.hermesTimeoutMs, 4_500)),
    },
  };
}

export function getAgentGatewayStatus() {
  const config = getAgentGatewayRuntimeConfig();
  return {
    status: config.enabled ? "online" : "disabled",
    provider: config.provider,
    model: config.model,
    fallback: "legacy",
    hermes: {
      enabled: config.hermes.enabled,
      configured: config.hermes.configured,
      model: config.hermes.model,
      timeoutMs: config.hermes.timeoutMs,
    },
  } as const;
}
