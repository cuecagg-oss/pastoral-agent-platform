import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  churchCells,
  leaders,
  members,
  meetings,
  organizationMemberships,
  organizations,
  reports,
  users,
  visitors,
} from "../../drizzle/schema";

let demoSeedPromise: Promise<void> | undefined;

async function organization(db: MySql2Database<Record<string, unknown>>, slug: string, name: string) {
  const existing = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(organizations).values({ slug, name });
  const created = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  if (!created[0]) throw new Error("Não foi possível criar a organização de demonstração.");
  return created[0];
}

async function cell(db: MySql2Database<Record<string, unknown>>, organizationId: number, data: { name: string; leaderName: string; supervisorName: string }) {
  const existing = await db.select().from(churchCells).where(and(eq(churchCells.organizationId, organizationId), eq(churchCells.name, data.name))).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(churchCells).values({ organizationId, ...data });
  const created = await db.select().from(churchCells).where(and(eq(churchCells.organizationId, organizationId), eq(churchCells.name, data.name))).limit(1);
  if (!created[0]) throw new Error("Não foi possível criar a célula de demonstração.");
  return created[0];
}

async function ensureUser(db: MySql2Database<Record<string, unknown>>, openId: string, name: string) {
  const existing = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(users).values({ openId, name, loginMethod: "demo", role: "user" });
  const created = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (!created[0]) throw new Error("Não foi possível criar usuário demonstrativo.");
  return created[0];
}

async function ensureMembership(db: MySql2Database<Record<string, unknown>>, organizationId: number, userId: number, role: "pastor" | "leader") {
  const existing = await db.select().from(organizationMemberships).where(and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.userId, userId))).limit(1);
  if (!existing[0]) await db.insert(organizationMemberships).values({ organizationId, userId, role });
}

async function ensureLeader(db: MySql2Database<Record<string, unknown>>, organizationId: number, cellId: number, name: string, attentionNote?: string) {
  const existing = await db.select().from(leaders).where(and(eq(leaders.organizationId, organizationId), eq(leaders.name, name))).limit(1);
  if (!existing[0]) await db.insert(leaders).values({ organizationId, cellId, name, attentionNote: attentionNote ?? null });
}

async function ensureMember(db: MySql2Database<Record<string, unknown>>, organizationId: number, cellId: number, name: string) {
  const existing = await db.select().from(members).where(and(eq(members.organizationId, organizationId), eq(members.name, name))).limit(1);
  if (!existing[0]) await db.insert(members).values({ organizationId, cellId, name });
}

async function ensureVisitor(db: MySql2Database<Record<string, unknown>>, organizationId: number, name: string, followedUp: boolean) {
  const existing = await db.select().from(visitors).where(and(eq(visitors.organizationId, organizationId), eq(visitors.name, name))).limit(1);
  if (!existing[0]) await db.insert(visitors).values({ organizationId, name, phone: "(11) 99999-0000", firstVisitAt: new Date(Date.now() - 2 * 86400000), followedUp });
}

async function ensureReport(db: MySql2Database<Record<string, unknown>>, organizationId: number, cellId: number, delivered: boolean) {
  const weekLabel = "Semana atual (demonstração)";
  const existing = await db.select().from(reports).where(and(eq(reports.organizationId, organizationId), eq(reports.cellId, cellId), eq(reports.weekLabel, weekLabel))).limit(1);
  if (!existing[0]) await db.insert(reports).values({ organizationId, cellId, weekLabel, delivered, submittedAt: delivered ? new Date() : null });
}

async function ensureMeeting(db: MySql2Database<Record<string, unknown>>, organizationId: number, cellId: number, wasHeld: boolean, attendanceCount: number) {
  const existing = await db.select().from(meetings).where(and(eq(meetings.organizationId, organizationId), eq(meetings.cellId, cellId))).limit(1);
  if (!existing[0]) await db.insert(meetings).values({ organizationId, cellId, wasHeld, attendanceCount, occurredAt: new Date(Date.now() - 2 * 86400000) });
}

async function seed(db: MySql2Database<Record<string, unknown>>) {
  const churchA = await organization(db, "igreja-demonstracao-a", "Igreja Demonstração A");
  const churchB = await organization(db, "igreja-demonstracao-b", "Igreja Demonstração B");
  const demoPastorA = await ensureUser(db, "demo-pastor-a", "Pastor Samuel — Demonstração A");
  const demoPastorB = await ensureUser(db, "demo-pastor-b", "Pastora Elisa — Demonstração B");
  await ensureMembership(db, churchA.id, demoPastorA.id, "pastor");
  await ensureMembership(db, churchB.id, demoPastorB.id, "pastor");

  const esperanca = await cell(db, churchA.id, { name: "Célula Esperança", leaderName: "Marina Costa", supervisorName: "Pr. Rafael Lima" });
  const graca = await cell(db, churchA.id, { name: "Célula Graça", leaderName: "Diego Alves", supervisorName: "Pr. Rafael Lima" });
  const vida = await cell(db, churchA.id, { name: "Célula Vida", leaderName: "Aline Souza", supervisorName: "Pr. Rafael Lima" });
  const familia = await cell(db, churchA.id, { name: "Célula Família", leaderName: "Ricardo Melo", supervisorName: "Pr. Rafael Lima" });
  const luz = await cell(db, churchB.id, { name: "Célula Luz", leaderName: "Helena Prado", supervisorName: "Pr. André Lopes" });

  await Promise.all([
    ensureLeader(db, churchA.id, esperanca.id, "Marina Costa"),
    ensureLeader(db, churchA.id, graca.id, "Diego Alves", "Queda de presença por duas semanas; recomende contato de supervisão."),
    ensureLeader(db, churchA.id, vida.id, "Aline Souza"),
    ensureLeader(db, churchA.id, familia.id, "Ricardo Melo", "Relatório pendente e ausência na última reunião de líderes."),
    ensureLeader(db, churchB.id, luz.id, "Helena Prado"),
    ensureMember(db, churchA.id, esperanca.id, "Carla Martins"),
    ensureMember(db, churchA.id, graca.id, "Thiago Freitas"),
    ensureMember(db, churchA.id, vida.id, "Renata Alves"),
    ensureVisitor(db, churchA.id, "João Pereira", false),
    ensureVisitor(db, churchA.id, "Camila Rocha", true),
    ensureVisitor(db, churchA.id, "Bruno Santos", false),
    ensureVisitor(db, churchB.id, "Lara Nunes", false),
    ensureReport(db, churchA.id, esperanca.id, true),
    ensureReport(db, churchA.id, graca.id, false),
    ensureReport(db, churchA.id, vida.id, true),
    ensureReport(db, churchA.id, familia.id, false),
    ensureReport(db, churchB.id, luz.id, true),
    ensureMeeting(db, churchA.id, esperanca.id, true, 14),
    ensureMeeting(db, churchA.id, graca.id, true, 6),
    ensureMeeting(db, churchA.id, vida.id, true, 11),
    ensureMeeting(db, churchA.id, familia.id, false, 0),
    ensureMeeting(db, churchB.id, luz.id, true, 16),
  ]);
}

export async function ensureDemoData(db: MySql2Database<Record<string, unknown>>) {
  demoSeedPromise ??= seed(db).catch(error => {
    demoSeedPromise = undefined;
    throw error;
  });
  return demoSeedPromise;
}

export async function ensureCurrentUserMembership(db: MySql2Database<Record<string, unknown>>, userId: number) {
  await ensureDemoData(db);
  const membership = await db.select().from(organizationMemberships).where(eq(organizationMemberships.userId, userId)).limit(1);
  if (membership[0]) return;
  const churchA = await db.select().from(organizations).where(eq(organizations.slug, "igreja-demonstracao-a")).limit(1);
  if (!churchA[0]) throw new Error("A organização de demonstração não foi encontrada.");
  await db.insert(organizationMemberships).values({ organizationId: churchA[0].id, userId, role: "pastor" });
}
