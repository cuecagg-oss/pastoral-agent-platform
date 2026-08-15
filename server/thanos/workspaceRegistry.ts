import type { WorkspaceDefinition } from "./contracts";
import { toWorkspaceKey, type WorkspaceKey } from "./contextIdentity";

export class WorkspaceNotRegisteredError extends Error {
  constructor(workspaceKey: string) {
    super(`Workspace não registrado: ${workspaceKey}.`);
    this.name = "WorkspaceNotRegisteredError";
  }
}

export class WorkspaceRegistry<TSourceContext> {
  private readonly definitions: ReadonlyMap<string, WorkspaceDefinition<TSourceContext>>;

  constructor(definitions: readonly WorkspaceDefinition<TSourceContext>[]) {
    const entries = new Map<string, WorkspaceDefinition<TSourceContext>>();
    for (const definition of definitions) {
      const key = definition.workspaceKey as string;
      if (entries.has(key)) {
        throw new Error(`Workspace duplicado no registro: ${key}.`);
      }
      entries.set(key, definition);
    }
    this.definitions = entries;
  }

  get(workspaceKey: WorkspaceKey | string): WorkspaceDefinition<TSourceContext> {
    const normalizedKey = toWorkspaceKey(workspaceKey as string) as string;
    const definition = this.definitions.get(normalizedKey);
    if (!definition) {
      throw new WorkspaceNotRegisteredError(normalizedKey);
    }
    return definition;
  }

  list(): readonly Pick<WorkspaceDefinition<TSourceContext>, "workspaceKey" | "domain" | "displayName">[] {
    return Object.freeze(
      Array.from(this.definitions.values()).map(({ workspaceKey, domain, displayName }) => Object.freeze({ workspaceKey, domain, displayName })),
    );
  }
}
