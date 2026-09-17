export interface Commit {
  id: string;
  parentIds: string[];
  message: string;
  createdOnBranch: string;
}

export interface Tag {
  commit: string;
  message?: string;
  annotated: boolean;
}

export type Head =
  | { type: "branch"; name: string }
  | { type: "detached"; commit: string };

export interface RepoState {
  initialized: boolean;
  commits: Record<string, Commit>;
  branches: Record<string, string | null>;
  head: Head;
  staged: string[];
  workingChanges: string[];
  tags: Record<string, Tag>;
  commitCounter: number;
}

export interface CommandResult {
  ok: boolean;
  output: string[];
  state: RepoState;
  unlockedCommand?: string;
}

export function createInitialState(): RepoState {
  return {
    initialized: false,
    commits: {},
    branches: {},
    head: { type: "branch", name: "main" },
    staged: [],
    workingChanges: [],
    tags: {},
    commitCounter: 0,
  };
}
