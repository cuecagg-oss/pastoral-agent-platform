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

export const organizationAgentSettings = mysqlTable(
  "organization_agent_settings",
  {
    organizationId: int("organizationId").primaryKey(),
    enabled: boolean("enabled").default(true).notNull(),
    provider: mysqlEnum("provider", ["legacy", "hermes"]).default("legacy").notNull(),
    model: varchar("model", { length: 120 }).default("legacy-router").notNull(),
    fallbackPolicy: mysqlEnum("fallbackPolicy", ["deterministic"]).default("deterministic").notNull(),
    updatedByUserId: int("updatedByUserId"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("agent_settings_updated_idx").on(table.updatedAt)],
);

export const organizationToolSettings = mysqlTable(
  "organization_tool_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull(),
    toolName: varchar("toolName", { length: 120 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    updatedByUserId: int("updatedByUserId").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("organization_tool_settings_org_tool_unique").on(table.organizationId, table.toolName),
    index("organization_tool_settings_updated_idx").on(table.organizationId, table.updatedAt),
  ],
);

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
    provider: varchar("provider", { length: 80 }),
    tool: varchar("tool", { length: 120 }),
    requestId: varchar("requestId", { length: 80 }),
    result: varchar("result", { length: 120 }),
    confirmationStatus: mysqlEnum("confirmationStatus", ["not_required", "pending", "confirmed", "duplicate", "denied", "failed"]),
    status: mysqlEnum("status", ["success", "failure", "denied"]).notNull(),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("audit_organization_created_idx").on(table.organizationId, table.createdAt),
    index("audit_organization_request_idx").on(table.organizationId, table.requestId),
  ],
);

export const chatSyntheticMonitors = mysqlTable(
  "chat_synthetic_monitors",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 80 }).notNull().unique(),
    scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
    enabled: boolean("enabled").default(true).notNull(),
    cadenceMinutes: int("cadence_minutes").default(15).notNull(),
    lastRunAt: timestamp("last_run_at"),
    lastStatus: mysqlEnum("last_status", ["healthy", "unhealthy", "skipped"]),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("chat_synthetic_monitor_task_uid_idx").on(table.scheduleCronTaskUid)],
);

export const chatSyntheticCheckRuns = mysqlTable(
  "chat_synthetic_check_runs",
  {
    id: int("id").autoincrement().primaryKey(),
    monitorId: int("monitor_id").notNull(),
    organizationId: int("organization_id").notNull(),
    scheduledFor: timestamp("scheduled_for").notNull(),
    status: mysqlEnum("status", ["healthy", "unhealthy", "skipped"]).notNull(),
    responseValid: boolean("response_valid").notNull(),
    durationMs: int("duration_ms").notNull(),
    reason: varchar("reason", { length: 120 }),
    checkedAt: timestamp("checked_at").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("chat_synthetic_check_run_unique").on(table.monitorId, table.organizationId, table.scheduledFor),
    index("chat_synthetic_check_runs_organization_idx").on(table.organizationId, table.checkedAt),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
