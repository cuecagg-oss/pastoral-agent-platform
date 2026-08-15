import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { AgentCore } from "./pastoral/agentCore";
import { AgentGateway } from "./pastoral/agentGateway";
import { getAgentGatewayStatus } from "./pastoral/gatewayConfig";
import { getTenantGatewayConfig, toSanitizedTenantGatewayStatus, updateTenantGatewayConfig } from "./pastoral/tenantGatewayConfig";
import { listSanitizedToolCatalog } from "./pastoral/toolCatalog";
import { getTenantToolCatalog, updateTenantToolStatus } from "./pastoral/tenantToolConfig";
import { pastoralToolNames } from "./pastoral/types";
import { DatabasePastoralRepository, dashboardSummary, getOrCreateConversation, getTenantContextForUser, listMessages } from "./pastoral/repository";

const repository = new DatabasePastoralRepository();
const agentCore = new AgentCore(repository);
const agentGateway = new AgentGateway(repository, agentCore);

async function currentTenant(userId: number) {
  return getTenantContextForUser(userId);
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  pastoral: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const tenant = await currentTenant(ctx.user.id);
      const summary = await dashboardSummary(tenant);
      return { tenant, summary, agent: toSanitizedTenantGatewayStatus(await getTenantGatewayConfig(tenant)) };
    }),
    agentSettings: protectedProcedure.query(async ({ ctx }) => {
      const tenant = await currentTenant(ctx.user.id);
      return toSanitizedTenantGatewayStatus(await getTenantGatewayConfig(tenant));
    }),
    toolCatalog: protectedProcedure.query(async ({ ctx }) => {
      const tenant = await currentTenant(ctx.user.id);
      return listSanitizedToolCatalog(tenant, await getTenantToolCatalog(tenant));
    }),
    updateToolStatus: protectedProcedure.input(z.object({
      name: z.enum(pastoralToolNames),
      enabled: z.boolean(),
    })).mutation(async ({ ctx, input }) => {
      const tenant = await currentTenant(ctx.user.id);
      const catalog = await updateTenantToolStatus(tenant, input);
      await repository.audit({
        context: tenant,
        action: "agent_tool.settings.update",
        agent: "admin-settings",
        tool: input.name,
        status: "success",
        metadata: { enabled: input.enabled },
      });
      return listSanitizedToolCatalog(tenant, catalog);
    }),
    updateAgentSettings: protectedProcedure.input(z.object({
      enabled: z.boolean(),
      provider: z.enum(["legacy", "hermes"]),
      model: z.string().trim().min(1).max(160),
      fallbackPolicy: z.literal("deterministic"),
    })).mutation(async ({ ctx, input }) => {
      const tenant = await currentTenant(ctx.user.id);
      const config = await updateTenantGatewayConfig(tenant, input);
      await repository.audit({
        context: tenant,
        action: "agent_gateway.settings.update",
        agent: "admin-settings",
        model: config.model,
        tool: "agent_gateway_config",
        status: "success",
        metadata: { enabled: config.enabled, provider: config.provider, fallbackPolicy: config.fallbackPolicy },
      });
      return toSanitizedTenantGatewayStatus(config);
    }),
    currentConversation: protectedProcedure.query(async ({ ctx }) => {
      const tenant = await currentTenant(ctx.user.id);
      return getOrCreateConversation(tenant);
    }),
    messages: protectedProcedure.input(z.object({ conversationId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const tenant = await currentTenant(ctx.user.id);
      return listMessages(tenant, input.conversationId);
    }),
    sendMessage: protectedProcedure.input(z.object({ conversationId: z.number().int().positive(), content: z.string().trim().min(1).max(4000) })).mutation(async ({ ctx, input }) => {
      const tenant = await currentTenant(ctx.user.id);
      return agentGateway.respond({ context: tenant, conversationId: input.conversationId, message: input.content });
    }),
    confirmFollowup: protectedProcedure.input(z.object({ conversationId: z.number().int().positive(), visitorId: z.number().int().positive(), note: z.string().min(1).max(2000), idempotencyKey: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const tenant = await currentTenant(ctx.user.id);
      return agentGateway.confirmFollowup({ context: tenant, ...input });
    }),
  }),
});

export type AppRouter = typeof appRouter;
