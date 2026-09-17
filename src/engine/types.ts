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
  lastCommand: string | null;
  /** Remotes registrados, nome -> url (fake, não há rede de verdade). */
  remotes: Record<string, string>;
  /**
   * Estado real do remoto, chave "origin/main" -> commit. Só muda com push
   * (ou já vem populado no setup de um desafio, simulando trabalho de outra
   * pessoa que já chegou lá).
   */
  remoteBranches: Record<string, string | null>;
  /**
   * Última cópia local do estado do remoto ("origin/main" -> commit), o que
   * o grafo desenha como referência de rastreamento. Só avança com fetch,
   * pull ou push — nunca sozinha.
   */
  trackingBranches: Record<string, string | null>;
  /** Branch local -> ref remota que ela rastreia, ex: "main" -> "origin/main". */
  upstream: Record<string, string>;
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
    lastCommand: null,
    remotes: {},
    remoteBranches: {},
    trackingBranches: {},
    upstream: {},
  };
}
