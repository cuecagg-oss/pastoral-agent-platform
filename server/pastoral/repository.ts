import { and, desc, eq } from "drizzle-orm";
import {
  auditLogs,
  churchCells,
  conversationMessages,
  conversations,
  leaders,
  meetings,
  organizationMemberships,
  organizations,
  reports,
  users,
  visitorFollowups,
  visitors,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { assertTenantScope, TenantIsolationError } from "./policy";
import { ensureCurrentUserMembership, ensureDemoData } from "./seed";
import type { PastoralRepository, TenantContext, ToolResult, VisitorCandidate } from "./types";

function requireDb<T>(value: T | null): T {
  if (!value) throw new Error("Banco de dados indisponível. Tente novamente em instantes.");
  return value;
}

export async function getTenantContextForUser(userId: number): Promise<TenantContext> {
  const db = requireDb(await getDb());
  await ensureCurrentUserMembership(db, userId);
  const rows = await db
    .select({ organizationId: organizations.id, organizationName: organizations.name, userId: users.id, userName: users.name, role: organizationMemberships.role })
    .from(organizationMemberships)
    .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
    .innerJoin(users, eq(organizationMemberships.userId, users.id))
    .where(eq(organizationMemberships.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Não foi possível estabelecer o contexto da organização.");
  return { organizationId: row.organizationId, organizationName: row.organizationName, userId: row.userId, userName: row.userName ?? "Usuário", role: row.role };
}

export async function getOrCreateConversation(context: TenantContext) {
  const db = requireDb(await getDb());
  const existing = await db.select().from(conversations)
    .where(and(eq(conversations.organizationId, context.organizationId), eq(conversations.userId, context.userId)))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);
  if (existing[0]) return existing[0];
  await db.insert(conversations).values({ organizationId: context.organizationId, userId: context.userId });
  const created = await db.select().from(conversations)
    .where(and(eq(conversations.organizationId, context.organizationId), eq(conversations.userId, context.userId)))
    .orderBy(desc(conversations.id))
    .limit(1);
  if (!created[0]) throw new Error("Não foi possível iniciar a conversa.");
  return created[0];
}

export async function listMessages(context: TenantContext, conversationId: number) {
  const db = requireDb(await getDb());
  const conversation = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conversation[0]) throw new Error("Conversa não encontrada.");
  assertTenantScope(context, conversation[0].organizationId);
  if (conversation[0].userId !== context.userId) throw new TenantIsolationError();
  return db.select().from(conversationMessages)
    .where(and(eq(conversationMessages.conversationId, conversationId), eq(conversationMessages.organizationId, context.organizationId)))
    .orderBy(conversationMessages.id);
}

export async function dashboardSummary(context: TenantContext) {
  const db = requireDb(await getDb());
  const [cells, pendingReports, openVisitors] = await Promise.all([
    db.select().from(churchCells).where(eq(churchCells.organizationId, context.organizationId)),
    db.select().from(reports).where(and(eq(reports.organizationId, context.organizationId), eq(reports.delivered, false))),
    db.select().from(visitors).where(and(eq(visitors.organizationId, context.organizationId), eq(visitors.followedUp, false))),
  ]);
  return { cells: cells.length, pendingReports: pendingReports.length, openVisitors: openVisitors.length };
}

export class DatabasePastoralRepository implements PastoralRepository {
  private async db() {
    const db = requireDb(await getDb());
    await ensureDemoData(db);
    return db;
  }

  async queryCells(context: TenantContext): Promise<ToolResult> {
    const rows = await (await this.db()).select().from(churchCells).where(eq(churchCells.organizationId, context.organizationId));
    return { tool: "consultar_celulas", summary: `A ${context.organizationName} possui **${rows.length} células ativas**: ${rows.map(row => row.name).join(", ")}.`, data: { cells: rows.map(row => ({ name: row.name, leader: row.leaderName, supervisor: row.supervisorName })) } };
  }

  async queryReports(context: TenantContext): Promise<ToolResult> {
    const db = await this.db();
    const pending = await db.select({ cellName: churchCells.name, weekLabel: reports.weekLabel })
      .from(reports).innerJoin(churchCells, eq(reports.cellId, churchCells.id))
      .where(and(eq(reports.organizationId, context.organizationId), eq(reports.delivered, false)));
    const names = pending.map(row => row.cellName);
    return { tool: "consultar_relatorios", summary: names.length ? `Ainda não entregaram relatório nesta semana: **${names.join(", ")}**.` : "Todas as células entregaram o relatório desta semana.", data: { pendingReports: pending } };
  }

  async queryAttendance(context: TenantContext): Promise<ToolResult> {
    const db = await this.db();
    const rows = await db.select({ cellName: churchCells.name, wasHeld: meetings.wasHeld, attendanceCount: meetings.attendanceCount })
      .from(meetings).innerJoin(churchCells, eq(meetings.cellId, churchCells.id))
      .where(eq(meetings.organizationId, context.organizationId));
    const held = rows.filter(row => row.wasHeld);
    const missed = rows.filter(row => !row.wasHeld).map(row => row.cellName);
    const lowAttendance = held.filter(row => row.attendanceCount < 8).map(row => `${row.cellName} (${row.attendanceCount})`);
    const suffix = [missed.length ? `não realizaram: ${missed.join(", ")}` : "", lowAttendance.length ? `atenção para presença: ${lowAttendance.join(", ")}` : ""].filter(Boolean).join(". ");
    return { tool: "consultar_presenca", summary: `**${held.length} células realizaram reunião** nesta semana.${suffix ? ` Também, ${suffix}.` : ""}`, data: { meetings: rows, heldCount: held.length, missed, lowAttendance } };
  }

  async queryVisitors(context: TenantContext): Promise<ToolResult> {
    const rows = await (await this.db()).select().from(visitors).where(eq(visitors.organizationId, context.organizationId));
    const pending = rows.filter(row => !row.followedUp);
    return { tool: "consultar_visitantes", summary: rows.length ? `Houve **${rows.length} visitantes** registrados. Ainda aguardam acompanhamento: **${pending.map(row => row.name).join(", ") || "nenhum"}**.` : "Não há visitantes registrados nesta semana.", data: { visitors: rows.map(row => ({ id: row.id, name: row.name, followedUp: row.followedUp })) } };
  }

  async queryLeaders(context: TenantContext): Promise<ToolResult> {
    const rows = await (await this.db()).select().from(leaders).where(eq(leaders.organizationId, context.organizationId));
    const attention = rows.filter(row => row.attentionNote);
    return { tool: "consultar_lideres", summary: attention.length ? `Líderes que merecem atenção: ${attention.map(row => `**${row.name}** — ${row.attentionNote}`).join("; ")}.` : "Não há alertas de atenção para os líderes nesta semana.", data: { leaders: rows.map(row => ({ name: row.name, attentionNote: row.attentionNote })) } };
  }

  async findVisitor(context: TenantContext, name: string): Promise<VisitorCandidate | null> {
    const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const rows = await (await this.db()).select().from(visitors).where(eq(visitors.organizationId, context.organizationId));
    const match = rows.find(row => row.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalized));
    return match ? { id: match.id, name: match.name, followedUp: match.followedUp } : null;
  }

  async appendMessage(input: { conversationId: number; context: TenantContext; role: "user" | "assistant"; content: string; messageType?: "text" | "voice"; model?: string; tool?: string }) {
    const db = await this.db();
    const conversation = await db.select().from(conversations).where(eq(conversations.id, input.conversationId)).limit(1);
    if (!conversation[0]) throw new Error("Conversa não encontrada.");
    assertTenantScope(input.context, conversation[0].organizationId);
    if (conversation[0].userId !== input.context.userId) throw new TenantIsolationError();
    await db.insert(conversationMessages).values({ conversationId: input.conversationId, organizationId: input.context.organizationId, userId: input.context.userId, role: input.role, messageType: input.messageType ?? "text", content: input.content, model: input.model ?? null, tool: input.tool ?? null });
  }

  async writeFollowup(input: { context: TenantContext; visitorId: number; note: string; idempotencyKey: string }) {
    const db = await this.db();
    const visitor = await db.select().from(visitors).where(eq(visitors.id, input.visitorId)).limit(1);
    if (!visitor[0]) throw new Error("Visitante não encontrado.");
    assertTenantScope(input.context, visitor[0].organizationId);
    const previous = await db.select().from(visitorFollowups).where(eq(visitorFollowups.idempotencyKey, input.idempotencyKey)).limit(1);
    if (previous[0]) return { created: false, visitorName: visitor[0].name };
    await db.insert(visitorFollowups).values({ organizationId: input.context.organizationId, visitorId: input.visitorId, completedByUserId: input.context.userId, note: input.note, idempotencyKey: input.idempotencyKey });
    await db.update(visitors).set({ followedUp: true }).where(and(eq(visitors.id, input.visitorId), eq(visitors.organizationId, input.context.organizationId)));
    return { created: true, visitorName: visitor[0].name };
  }

  async audit(input: { context: TenantContext; action: string; agent: string; model?: string; tool?: string; status: "success" | "failure" | "denied"; metadata?: Record<string, unknown> }) {
    await (await this.db()).insert(auditLogs).values({ organizationId: input.context.organizationId, userId: input.context.userId, action: input.action, agent: input.agent, model: input.model ?? null, tool: input.tool ?? null, status: input.status, metadata: input.metadata ?? null });
  }
}
