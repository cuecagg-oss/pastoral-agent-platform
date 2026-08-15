import type { Request, Response } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  chatSyntheticCheckRuns,
  chatSyntheticMonitors,
  organizationMemberships,
  organizations,
  users,
} from "../../drizzle/schema";
import { sdk } from "../_core/sdk";
import { getDb } from "../db";
import { AgentCore } from "./agentCore";
import { AgentGateway } from "./agentGateway";
import { DatabasePastoralRepository } from "./repository";
import { ThanosPilotRouter } from "./thanosPilotRouter";
import type { PastoralRepository, TenantContext, ToolResult, VisitorCandidate } from "./types";
import { PastoralThanosFacade } from "../workspaces/pastoral/thanosFacade";

const MONITOR_NAME = "chat-response-health";
const SYNTHETIC_MESSAGE = "Quantas células ativas existem nesta igreja?";
const MIN_VALID_RESPONSE_LENGTH = 12;

type CheckStatus = "healthy" | "unhealthy" | "skipped";

export type SyntheticCheckOutcome = {
  context: TenantContext;
  status: Exclude<CheckStatus, "skipped">;
  responseValid: boolean;
  durationMs: number;
  reason: string | null;
};

function requireDb<T>(value: T | null): T {
  if (!value) throw new Error("Banco de dados indisponível para o monitor sintético.");
  return value;
}

function scheduledBucket(date: Date, cadenceMinutes: number): Date {
  const interval = Math.max(1, cadenceMinutes) * 60_000;
  return new Date(Math.floor(date.getTime() / interval) * interval);
}

function sanitizedFailureReason(error: unknown): string {
  if (error instanceof Error && error.message.includes("temporariamente indisponível")) return "safe_unavailable_response";
  if (error instanceof Error && error.message.includes("não autorizado")) return "authorization_failure";
  return "response_execution_failed";
}

export function isValidSyntheticChatResponse(content: string | null | undefined): boolean {
  const normalized = content?.replace(/\s+/g, " ").trim() ?? "";
  return normalized.length >= MIN_VALID_RESPONSE_LENGTH;
}

export async function executeSyntheticChatCheck(
  context: TenantContext,
  respond: (input: { context: TenantContext; conversationId: number; message: string; requestId: string }) => Promise<{ content: string; tool?: string }>,
  requestId: string,
  now: () => number = Date.now,
): Promise<SyntheticCheckOutcome> {
  const startedAt = now();
  try {
    const response = await respond({ context, conversationId: 0, message: SYNTHETIC_MESSAGE, requestId });
    const responseValid = response.tool === "consultar_celulas" && isValidSyntheticChatResponse(response.content);
    return { context, status: responseValid ? "healthy" : "unhealthy", responseValid, durationMs: Math.max(0, now() - startedAt), reason: responseValid ? null : "invalid_response" };
  } catch (error) {
    return { context, status: "unhealthy", responseValid: false, durationMs: Math.max(0, now() - startedAt), reason: sanitizedFailureReason(error) };
  }
}

class NonPersistingSyntheticRepository implements PastoralRepository {
  constructor(private readonly delegate: PastoralRepository) {}

  queryCells(context: TenantContext): Promise<ToolResult> { return this.delegate.queryCells(context); }
  queryReports(context: TenantContext): Promise<ToolResult> { return this.delegate.queryReports(context); }
  queryAttendance(context: TenantContext): Promise<ToolResult> { return this.delegate.queryAttendance(context); }
  queryVisitors(context: TenantContext): Promise<ToolResult> { return this.delegate.queryVisitors(context); }
  queryLeaders(context: TenantContext): Promise<ToolResult> { return this.delegate.queryLeaders(context); }
  findVisitor(context: TenantContext, name: string): Promise<VisitorCandidate | null> { return this.delegate.findVisitor(context, name); }
  appendMessage(): Promise<void> { return Promise.resolve(); }
  writeFollowup(input: { context: TenantContext; visitorId: number; note: string; idempotencyKey: string }) {
    return this.delegate.writeFollowup(input);
  }
  audit(input: Parameters<PastoralRepository["audit"]>[0]): Promise<void> { return this.delegate.audit(input); }
}

async function listSyntheticContexts(): Promise<TenantContext[]> {
  const db = requireDb(await getDb());
  const rows = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      userId: users.id,
      userName: users.name,
      role: organizationMemberships.role,
    })
    .from(organizations)
    .innerJoin(organizationMemberships, eq(organizationMemberships.organizationId, organizations.id))
    .innerJoin(users, eq(users.id, organizationMemberships.userId))
    .orderBy(asc(organizations.id), asc(organizationMemberships.id));

  const contexts = new Map<number, TenantContext>();
  for (const row of rows) {
    if (!contexts.has(row.organizationId)) {
      contexts.set(row.organizationId, {
        organizationId: row.organizationId,
        organizationName: row.organizationName,
        userId: row.userId,
        userName: row.userName ?? "Monitor sintético",
        role: row.role,
      });
    }
  }
  return Array.from(contexts.values());
}

export type SyntheticMonitorSummary = {
  monitorId: number;
  scheduledFor: Date;
  checked: number;
  healthy: number;
  unhealthy: number;
  skipped: number;
};

export async function runSyntheticChatMonitor(taskUid: string, now = new Date()): Promise<SyntheticMonitorSummary | null> {
  const db = requireDb(await getDb());
  const monitor = (await db.select().from(chatSyntheticMonitors)
    .where(eq(chatSyntheticMonitors.scheduleCronTaskUid, taskUid)).limit(1))[0];
  if (!monitor || !monitor.enabled) return null;

  const scheduledFor = scheduledBucket(now, monitor.cadenceMinutes);
  const contexts = await listSyntheticContexts();
  const repository = new DatabasePastoralRepository();
  const syntheticRepository = new NonPersistingSyntheticRepository(repository);
  const agentCore = new AgentCore(syntheticRepository);
  const gateway = new AgentGateway(syntheticRepository, agentCore);
  const router = new ThanosPilotRouter(syntheticRepository, gateway, new PastoralThanosFacade(syntheticRepository));
  const summary: SyntheticMonitorSummary = { monitorId: monitor.id, scheduledFor, checked: 0, healthy: 0, unhealthy: 0, skipped: 0 };

  for (const context of contexts) {
    const previous = (await db.select({ id: chatSyntheticCheckRuns.id }).from(chatSyntheticCheckRuns)
      .where(and(
        eq(chatSyntheticCheckRuns.monitorId, monitor.id),
        eq(chatSyntheticCheckRuns.organizationId, context.organizationId),
        eq(chatSyntheticCheckRuns.scheduledFor, scheduledFor),
      )).limit(1))[0];
    if (previous) {
      summary.skipped += 1;
      continue;
    }

    const requestId = `synthetic-${monitor.id}-${context.organizationId}-${scheduledFor.getTime()}`;
    const outcome = await executeSyntheticChatCheck(context, input => router.respond(input), requestId);
    await db.insert(chatSyntheticCheckRuns).values({
      monitorId: monitor.id,
      organizationId: context.organizationId,
      scheduledFor,
      status: outcome.status,
      responseValid: outcome.responseValid,
      durationMs: outcome.durationMs,
      reason: outcome.reason,
    });
    await repository.audit({
      context,
      action: "chat.synthetic_check",
      agent: "chat-synthetic-monitor",
      provider: "deterministic",
      model: "synthetic-health-v1",
      tool: "consultar_celulas",
      requestId,
      result: outcome.status === "healthy" ? "response_valid" : outcome.reason ?? "response_invalid",
      confirmationStatus: "not_required",
      status: outcome.status === "healthy" ? "success" : "failure",
      metadata: { check: "chat_response", responseValid: outcome.responseValid, durationMs: outcome.durationMs, scheduledFor: scheduledFor.toISOString() },
    });
    summary.checked += 1;
    if (outcome.status === "healthy") summary.healthy += 1;
    else summary.unhealthy += 1;
  }

  const lastStatus: CheckStatus = summary.unhealthy > 0 ? "unhealthy" : (summary.checked > 0 ? "healthy" : "skipped");
  await db.update(chatSyntheticMonitors).set({ lastRunAt: now, lastStatus }).where(eq(chatSyntheticMonitors.id, monitor.id));
  return summary;
}

export async function getSyntheticChatHealth(context: TenantContext) {
  const db = requireDb(await getDb());
  const latest = (await db.select({
    status: chatSyntheticCheckRuns.status,
    responseValid: chatSyntheticCheckRuns.responseValid,
    durationMs: chatSyntheticCheckRuns.durationMs,
    reason: chatSyntheticCheckRuns.reason,
    checkedAt: chatSyntheticCheckRuns.checkedAt,
  }).from(chatSyntheticCheckRuns)
    .where(eq(chatSyntheticCheckRuns.organizationId, context.organizationId))
    .orderBy(desc(chatSyntheticCheckRuns.checkedAt)).limit(1))[0];
  return latest ?? { status: "skipped" as const, responseValid: false, durationMs: null, reason: "not_run", checkedAt: null };
}

export function createSyntheticChatMonitorHandler(dependencies: {
  authenticateRequest?: typeof sdk.authenticateRequest;
  run?: typeof runSyntheticChatMonitor;
} = {}) {
  const authenticateRequest = dependencies.authenticateRequest ?? sdk.authenticateRequest.bind(sdk);
  const run = dependencies.run ?? runSyntheticChatMonitor;
  return async (req: Request, res: Response) => {
    try {
      const user = await authenticateRequest(req);
      if (!user.isCron || !user.taskUid) {
        res.status(403).json({ error: "cron_only" });
        return;
      }
      const summary = await run(user.taskUid);
      res.json(summary ? { ok: true, ...summary } : { ok: true, skipped: "orphan_or_disabled" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "synthetic_monitor_failed";
      console.error("[ChatSyntheticMonitor]", errorMessage);
      res.status(500).json({ error: "synthetic_monitor_failed", context: { route: "chat-synthetic-monitor" }, timestamp: new Date().toISOString() });
    }
  };
}

export function registerSyntheticChatMonitorRoute(app: { post(path: string, handler: (req: Request, res: Response) => Promise<void>): void }) {
  app.post("/api/scheduled/chat-synthetic-monitor", createSyntheticChatMonitorHandler());
}
