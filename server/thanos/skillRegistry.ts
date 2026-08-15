import type { SkillDefinition } from "./contracts";
import type { WorkspaceKey } from "./contextIdentity";

export class SkillNotRegisteredError extends Error {
  constructor(skillKey: string) {
    super(`Skill não registrada: ${skillKey}.`);
    this.name = "SkillNotRegisteredError";
  }
}

export class SkillWorkspaceMismatchError extends Error {
  constructor() {
    super("A skill solicitada não pertence ao workspace informado.");
    this.name = "SkillWorkspaceMismatchError";
  }
}

export class SkillRegistry {
  private readonly definitions: ReadonlyMap<string, SkillDefinition>;

  constructor(definitions: readonly SkillDefinition[]) {
    const entries = new Map<string, SkillDefinition>();
    for (const definition of definitions) {
      if (entries.has(definition.key)) {
        throw new Error(`Skill duplicada no registro: ${definition.key}.`);
      }
      entries.set(definition.key, Object.freeze({ ...definition, allowedTools: Object.freeze([...definition.allowedTools]) }));
    }
    this.definitions = entries;
  }

  getForWorkspace(workspaceKey: WorkspaceKey, skillKey: string): SkillDefinition {
    const skill = this.definitions.get(skillKey);
    if (!skill) {
      throw new SkillNotRegisteredError(skillKey);
    }
    if (skill.workspaceKey !== workspaceKey) {
      throw new SkillWorkspaceMismatchError();
    }
    return skill;
  }

  listForWorkspace(workspaceKey: WorkspaceKey): readonly SkillDefinition[] {
    return Object.freeze(Array.from(this.definitions.values()).filter(skill => skill.workspaceKey === workspaceKey));
  }
}
