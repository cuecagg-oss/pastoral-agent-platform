import { assertThanosCapability } from "./context";
import type { ThanosCapability, ThanosContext } from "./contracts";

export type ThanosEvidence = Readonly<{
  summary: string;
  data: Record<string, unknown>;
}>;

export type ThanosGeneration = Readonly<{
  content: string;
  provider: string;
  model: string;
}>;

export type ThanosReadTool = Readonly<{
  name: string;
  requiredCapability: ThanosCapability;
  execute(context: ThanosContext): Promise<ThanosEvidence>;
}>;

export type ThanosGeneratorPort = Readonly<{
  generate(input: Readonly<{ system: string; user: string; fallback: string; evidence: ThanosEvidence; context: ThanosContext }>): Promise<ThanosGeneration>;
}>;

export type ThanosAuditPort = Readonly<{
  record(event: Readonly<{
    context: ThanosContext;
    action: "thanos.read" | "thanos.read.denied" | "thanos.read.failed";
    status: "success" | "denied" | "failure";
    result: string;
    tool: string;
    provider?: string;
    model?: string;
  }>): Promise<void>;
}>;

export type ThanosReadResult = Readonly<{
  content: string;
  provider: string;
  model: string;
  tool: string;
  requestId: string;
  evidence: ThanosEvidence;
}>;

export class ThanosReadOrchestrator {
  constructor(private readonly audit: ThanosAuditPort) {}

  async run(input: Readonly<{
    context: ThanosContext;
    tool: ThanosReadTool;
    system: string;
    user: string;
    generator: ThanosGeneratorPort;
  }>): Promise<ThanosReadResult> {
    try {
      assertThanosCapability(input.context, input.tool.requiredCapability);
    } catch (error) {
      await this.audit.record({
        context: input.context,
        action: "thanos.read.denied",
        status: "denied",
        result: "capability_not_authorized",
        tool: input.tool.name,
      });
      throw error;
    }

    try {
      const evidence = await input.tool.execute(input.context);
      const generation = await input.generator.generate({
        context: input.context,
        system: input.system,
        user: input.user,
        fallback: evidence.summary,
        evidence,
      });
      await this.audit.record({
        context: input.context,
        action: "thanos.read",
        status: "success",
        result: "response_generated",
        tool: input.tool.name,
        provider: generation.provider,
        model: generation.model,
      });
      return Object.freeze({
        ...generation,
        tool: input.tool.name,
        requestId: input.context.requestId,
        evidence,
      });
    } catch (error) {
      await this.audit.record({
        context: input.context,
        action: "thanos.read.failed",
        status: "failure",
        result: "tool_or_generation_failed",
        tool: input.tool.name,
      });
      throw error;
    }
  }
}
