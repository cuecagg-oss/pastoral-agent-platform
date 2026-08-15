import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { AgentCore } from "./pastoral/agentCore";
import { DatabasePastoralRepository, dashboardSummary, getOrCreateConversation, getTenantContextForUser, listMessages } from "./pastoral/repository";

const repository = new DatabasePastoralRepository();
const agentCore = new AgentCore(repository);

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
      return { tenant, summary, agent: { status: "online", provider: process.env.AGENT_PROVIDER ?? "deterministic" } };
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
      return agentCore.respond({ context: tenant, conversationId: input.conversationId, message: input.content });
    }),
    confirmFollowup: protectedProcedure.input(z.object({ conversationId: z.number().int().positive(), visitorId: z.number().int().positive(), note: z.string().min(1).max(2000), idempotencyKey: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const tenant = await currentTenant(ctx.user.id);
      return agentCore.confirmFollowup({ context: tenant, ...input });
    }),
  }),
});

export type AppRouter = typeof appRouter;
