export type TenantRole = "admin" | "pastor" | "supervisor" | "leader";

export type TenantContext = {
  organizationId: number;
  organizationName: string;
  userId: number;
  userName: string;
  role: TenantRole;
};

export const pastoralToolNames = [
  "consultar_celulas",
  "consultar_relatorios",
  "consultar_presenca",
  "consultar_visitantes",
  "consultar_lideres",
] as const;

export type PastoralToolName = (typeof pastoralToolNames)[number];

export type ToolResult = {
  tool: PastoralToolName;
  summary: string;
  data: Record<string, unknown>;
};

export type VisitorCandidate = {
  id: number;
  name: string;
  followedUp: boolean;
};

export interface PastoralRepository {
  queryCells(context: TenantContext): Promise<ToolResult>;
  queryReports(context: TenantContext): Promise<ToolResult>;
  queryAttendance(context: TenantContext): Promise<ToolResult>;
  queryVisitors(context: TenantContext): Promise<ToolResult>;
  queryLeaders(context: TenantContext): Promise<ToolResult>;
  findVisitor(context: TenantContext, name: string): Promise<VisitorCandidate | null>;
  appendMessage(input: {
    conversationId: number;
    context: TenantContext;
    role: "user" | "assistant";
    content: string;
    model?: string;
    tool?: string;
  }): Promise<void>;
  writeFollowup(input: {
    context: TenantContext;
    visitorId: number;
    note: string;
    idempotencyKey: string;
  }): Promise<{ created: boolean; visitorName: string }>;
  audit(input: {
    context: TenantContext;
    action: string;
    agent: string;
    model?: string;
    tool?: string;
    status: "success" | "failure" | "denied";
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export type AgentResponse = {
  content: string;
  model: string;
  provider: string;
  tool?: string;
  confirmation?: {
    visitorId: number;
    visitorName: string;
    note: string;
    idempotencyKey: string;
  };
};
