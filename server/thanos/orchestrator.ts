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
    action: "thanos.read" | "thanos.read.denied" | "thanos.read.failed" | "thanos.read.step" | "thanos.read.step.failed";
    status: "success" | "denied" | "failure";
    result: string;
    tool: string;
    step?: number;
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

export type ThanosMultiStepReadResult = Readonly<{
  content: string;
  provider: string;
  model: string;
  tools: readonly string[];
  requestId: string;
  evidence: ThanosEvidence;
  fallback: boolean;
}>;

export class ThanosMultiStepPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThanosMultiStepPlanError";
  }
}

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

function composeEvidence(steps: readonly Readonly<{ tool: ThanosReadTool; evidence: ThanosEvidence }>[]): ThanosEvidence {
  if (steps.length === 0) {
    return Object.freeze({
      summary: "Nenhuma etapa de consulta foi concluída.",
      data: Object.freeze({ steps: Object.freeze([]) }),
    });
  }
  return Object.freeze({
    summary: steps.map(step => step.evidence.summary).join(" "),
    data: Object.freeze({
      steps: Object.freeze(steps.map(step => Object.freeze({ tool: step.tool.name, data: step.evidence.data }))),
    }),
  });
}

function deterministicFallback(evidence: ThanosEvidence): string {
  const prefix = evidence.summary === "Nenhuma etapa de consulta foi concluída." ? "" : `${evidence.summary} `;
  return `${prefix}Não foi possível concluir todas as consultas solicitadas no momento.`;
}

/** Orquestra um piloto explícito de 2–3 leituras autorizadas, sem habilitar operações de escrita. */
export class ThanosMultiStepReadOrchestrator {
  constructor(private readonly audit: ThanosAuditPort) {}

  async run(input: Readonly<{
    context: ThanosContext;
    steps: readonly ThanosReadTool[];
    system: string;
    user: string;
    generator: ThanosGeneratorPort;
  }>): Promise<ThanosMultiStepReadResult> {
    if (input.steps.length < 2 || input.steps.length > 3) {
      throw new ThanosMultiStepPlanError("O piloto multi-step exige entre duas e três ferramentas de leitura.");
    }

    const completed: Array<Readonly<{ tool: ThanosReadTool; evidence: ThanosEvidence }>> = [];
    for (let offset = 0; offset < input.steps.length; offset += 1) {
      const tool = input.steps[offset];
      const step = offset + 1;
      try {
        assertThanosCapability(input.context, tool.requiredCapability);
      } catch (error) {
        await this.audit.record({
          context: input.context,
          action: "thanos.read.denied",
          status: "denied",
          result: "capability_not_authorized",
          tool: tool.name,
          step,
        });
        throw error;
      }

      try {
        const evidence = await tool.execute(input.context);
        completed.push(Object.freeze({ tool, evidence }));
        await this.audit.record({
          context: input.context,
          action: "thanos.read.step",
          status: "success",
          result: "step_completed",
          tool: tool.name,
          step,
        });
      } catch (_error) {
        const evidence = composeEvidence(completed);
        await this.audit.record({
          context: input.context,
          action: "thanos.read.step.failed",
          status: "failure",
          result: "tool_execution_failed",
          tool: tool.name,
          step,
        });
        await this.audit.record({
          context: input.context,
          action: "thanos.read.failed",
          status: "failure",
          result: "multistep_partial_fallback",
          tool: tool.name,
        });
        return Object.freeze({
          content: deterministicFallback(evidence),
          provider: "deterministic",
          model: "thanos-multistep-fallback-v1",
          tools: Object.freeze(input.steps.map(candidate => candidate.name)),
          requestId: input.context.requestId,
          evidence,
          fallback: true,
        });
      }
    }

    const evidence = composeEvidence(completed);
    try {
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
        result: "multistep_response_generated",
        tool: input.steps.map(tool => tool.name).join(","),
        provider: generation.provider,
        model: generation.model,
      });
      return Object.freeze({
        ...generation,
        tools: Object.freeze(input.steps.map(tool => tool.name)),
        requestId: input.context.requestId,
        evidence,
        fallback: false,
      });
    } catch (_error) {
      await this.audit.record({
        context: input.context,
        action: "thanos.read.failed",
        status: "failure",
        result: "generation_failed_fallback",
        tool: input.steps.map(tool => tool.name).join(","),
      });
      return Object.freeze({
        content: deterministicFallback(evidence),
        provider: "deterministic",
        model: "thanos-multistep-fallback-v1",
        tools: Object.freeze(input.steps.map(tool => tool.name)),
        requestId: input.context.requestId,
        evidence,
        fallback: true,
      });
    }
  }
}
