import { SkillRegistry } from "./skillRegistry";
import { WorkspaceRegistry } from "./workspaceRegistry";
import {
  pastoralSkillDefinition,
  pastoralWorkspaceDefinition,
  type PastoralWorkspaceSource,
} from "../workspaces/pastoral/workspaceDefinition";

export const thanosWorkspaceRegistry = new WorkspaceRegistry<PastoralWorkspaceSource>([pastoralWorkspaceDefinition]);
export const thanosSkillRegistry = new SkillRegistry([pastoralSkillDefinition]);
