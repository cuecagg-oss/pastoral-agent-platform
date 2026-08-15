import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const organizationMemberships = mysqlTable(
  "organization_memberships",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    userId: int("userId").notNull(),
    role: mysqlEnum("role", ["admin", "pastor", "supervisor", "leader"]).default("pastor").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("membership_organization_user_unique").on(table.organizationId, table.userId),
    index("membership_user_idx").on(table.userId),
  ],
);

export const churchCells = mysqlTable(
  "church_cells",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    leaderName: varchar("leaderName", { length: 160 }).notNull(),
    supervisorName: varchar("supervisorName", { length: 160 }).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("cells_organization_idx").on(table.organizationId)],
);

export const leaders = mysqlTable(
  "leaders",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    cellId: int("cellId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    contact: varchar("contact", { length: 160 }),
    attentionNote: varchar("attentionNote", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("leaders_organization_idx").on(table.organizationId)],
);

export const members = mysqlTable(
  "members",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    cellId: int("cellId"),
    name: varchar("name", { length: 160 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("members_organization_idx").on(table.organizationId)],
);

export const visitors = mysqlTable(
  "visitors",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    firstVisitAt: timestamp("firstVisitAt").notNull(),
    phone: varchar("phone", { length: 40 }),
    followedUp: boolean("followedUp").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("visitors_organization_idx").on(table.organizationId)],
);

export const meetings = mysqlTable(
  "meetings",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    cellId: int("cellId").notNull(),
    occurredAt: timestamp("occurredAt").notNull(),
    wasHeld: boolean("wasHeld").notNull(),
    attendanceCount: int("attendanceCount").default(0).notNull(),
  },
  table => [index("meetings_organization_idx").on(table.organizationId)],
);

export const reports = mysqlTable(
  "reports",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    cellId: int("cellId").notNull(),
    weekLabel: varchar("weekLabel", { length: 80 }).notNull(),
    delivered: boolean("delivered").default(false).notNull(),
    submittedAt: timestamp("submittedAt"),
  },
  table => [index("reports_organization_idx").on(table.organizationId)],
);

export const conversations = mysqlTable(
  "conversations",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 180 }).default("Conversa pastoral").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("conversations_tenant_user_idx").on(table.organizationId, table.userId)],
);

export const conversationMessages = mysqlTable(
  "conversation_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    conversationId: int("conversationId").notNull(),
    organizationId: int("organizationId").notNull(),
    userId: int("userId").notNull(),
    role: mysqlEnum("role", ["user", "assistant"]).notNull(),
    messageType: mysqlEnum("messageType", ["text", "voice"]).default("text").notNull(),
    content: text("content").notNull(),
    model: varchar("model", { length: 120 }),
    tool: varchar("tool", { length: 120 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("messages_conversation_idx").on(table.conversationId, table.id)],
);

export const visitorFollowups = mysqlTable(
  "visitor_followups",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    visitorId: int("visitorId").notNull(),
    completedByUserId: int("completedByUserId").notNull(),
    note: text("note").notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 96 }).notNull().unique(),
    completedAt: timestamp("completedAt").defaultNow().notNull(),
  },
  table => [index("followups_organization_idx").on(table.organizationId)],
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    userId: int("userId").notNull(),
    action: varchar("action", { length: 120 }).notNull(),
    agent: varchar("agent", { length: 120 }).notNull(),
    model: varchar("model", { length: 120 }),
    tool: varchar("tool", { length: 120 }),
    status: mysqlEnum("status", ["success", "failure", "denied"]).notNull(),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("audit_organization_created_idx").on(table.organizationId, table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
