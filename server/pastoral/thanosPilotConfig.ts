import { ENV } from "../_core/env";
import { isFollowupIntent, isOrganizationCountIntent } from "./toolRegistry";
import type { ReadPastoralToolName, TenantContext } from "./types";

export type ThanosPilotMode = "single_read" | "multi_read";
export type ThanosPilotReason =
  | "pilot_disabled"
  | "kill_switch"
  | "pilot_audience_missing"
  | "organization_not_piloted"
  | "user_not_piloted"
  | "intent_not_eligible"
  | "eligible_single_read"
  | "eligible_multi_read";

export type ThanosPilotRuntimeConfig = Readonly<{
  enabled: boolean;
  killSwitch: boolean;
  organizationIds: readonly number[];
  userIds: readonly number[];
  version: string;
}>;

export type ThanosPilotDecision = Readonly<{
  route: "thanos" | "legacy";
  reason: ThanosPilotReason;
  version: string;
  mode?: ThanosPilotMode;
  tools?: readonly ReadPastoralToolName[];
}>;

const closedToolSet = new Set<ReadPastoralToolName>([
  "consultar_celulas",
  "consultar_presenca",
  "consultar_relatorios",
]);

function enabled(value: string) {
  return ["1", "true", "on", "yes"].includes(value.trim().toLowerCase());
}

function parsePositiveIds(value: string): readonly number[] {
  const ids = value.split(",")
    .map(item => Number.parseInt(item.trim(), 10))
    .filter(item => Number.isInteger(item) && item > 0);
  return Object.freeze(Array.from(new Set(ids)).slice(0, 100));
}

function sanitizedVersion(value: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 64);
  return normalized || "thanos-read-pilot-v1";
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function has(input: string, expression: RegExp) {
  return expression.test(input);
}

/** Resolve somente variáveis server-side; os allowlists jamais retornam ao cliente ou à auditoria. */
export function resolveThanosPilotRuntimeConfig(input: Readonly<{
  enabled: string;
  killSwitch: string;
  organizationIds: string;
  userIds: string;
  version: string;
}>): ThanosPilotRuntimeConfig {
  return Object.freeze({
    enabled: enabled(input.enabled),
    killSwitch: enabled(input.killSwitch),
    organizationIds: parsePositiveIds(input.organizationIds),
    userIds: parsePositiveIds(input.userIds),
    version: sanitizedVersion(input.version),
  });
}

export function getThanosPilotRuntimeConfig(): ThanosPilotRuntimeConfig {
  return resolveThanosPilotRuntimeConfig({
    enabled: ENV.thanosPilotEnabled,
    killSwitch: ENV.thanosPilotKillSwitch,
    organizationIds: ENV.thanosPilotOrganizationIds,
    userIds: ENV.thanosPilotUserIds,
    version: ENV.thanosPilotVersion,
  });
}

function selectClosedReadPlan(message: string): Readonly<{ mode: ThanosPilotMode; tools: readonly ReadPastoralToolName[] }> | null {
  if (isFollowupIntent(message) || isOrganizationCountIntent(message)) return null;
  const input = normalized(message);
  const asksForSummary = has(input, /\b(resumo|panorama|situacao|situacao geral)\b/);
  const cells = has(input, /\b(celula|celulas)\b/);
  const attendance = has(input, /\b(presenca|reuniao|reunioes|realizaram)\b/);
  const reports = has(input, /\b(relatorio|relatorios|entregaram)\b/);

  if (asksForSummary && cells && attendance && reports) {
    return Object.freeze({ mode: "multi_read", tools: Object.freeze(["consultar_celulas", "consultar_presenca", "consultar_relatorios"] as const) });
  }
  if (asksForSummary && cells && attendance) {
    return Object.freeze({ mode: "multi_read", tools: Object.freeze(["consultar_celulas", "consultar_presenca"] as const) });
  }
  if (cells) return Object.freeze({ mode: "single_read", tools: Object.freeze(["consultar_celulas"] as const) });
  if (attendance) return Object.freeze({ mode: "single_read", tools: Object.freeze(["consultar_presenca"] as const) });
  if (reports) return Object.freeze({ mode: "single_read", tools: Object.freeze(["consultar_relatorios"] as const) });
  return null;
}

export function decideThanosPilotRoute(input: Readonly<{
  context: TenantContext;
  message: string;
  config: ThanosPilotRuntimeConfig;
}>): ThanosPilotDecision {
  const { config, context } = input;
  if (!config.enabled) return Object.freeze({ route: "legacy", reason: "pilot_disabled", version: config.version });
  if (config.killSwitch) return Object.freeze({ route: "legacy", reason: "kill_switch", version: config.version });
  if (config.organizationIds.length === 0 && config.userIds.length === 0) return Object.freeze({ route: "legacy", reason: "pilot_audience_missing", version: config.version });
  if (config.organizationIds.length > 0 && !config.organizationIds.includes(context.organizationId)) return Object.freeze({ route: "legacy", reason: "organization_not_piloted", version: config.version });
  if (config.userIds.length > 0 && !config.userIds.includes(context.userId)) return Object.freeze({ route: "legacy", reason: "user_not_piloted", version: config.version });

  const plan = selectClosedReadPlan(input.message);
  if (!plan || plan.tools.some(tool => !closedToolSet.has(tool))) return Object.freeze({ route: "legacy", reason: "intent_not_eligible", version: config.version });
  return Object.freeze({ route: "thanos", reason: plan.mode === "multi_read" ? "eligible_multi_read" : "eligible_single_read", version: config.version, ...plan });
}

/** Estado seguro para controles administrativos futuros; não inclui allowlists ou valores de ambiente. */
export function getSanitizedThanosPilotStatus(config = getThanosPilotRuntimeConfig()) {
  return Object.freeze({ enabled: config.enabled, killSwitch: config.killSwitch, version: config.version });
}
