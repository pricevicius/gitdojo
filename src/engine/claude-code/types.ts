export type PermissionMode = "default" | "plan" | "acceptEdits" | "bypassPermissions";

export interface ClaudeCodeState {
  /** Sessão interativa aberta (depois de rodar `claude`, `claude -c` ou `claude --resume`). */
  sessionStarted: boolean;
  /** Existe uma sessão anterior fechada, retomável com `claude -c` / `claude --resume` / `/resume`. */
  hadPreviousSession: boolean;
  /** Uso da janela de contexto, 0-100. */
  contextPercent: number;
  permissionMode: PermissionMode;
  /** CLAUDE.md já existe (via `/init` ou uma memória rápida com `#`). */
  memoryFileCreated: boolean;
  /** Eventos de hook configurados, ex: ["PreToolUse"]. */
  hooks: string[];
  /** Nomes de servidores MCP conectados. */
  mcpServers: string[];
  /** Nomes de subagents criados. */
  agents: string[];
  /** O Claude acabou de editar algo nesta sessão e a edição pode ser desfeita com /rewind. */
  pendingEdit: boolean;
  costUsd: number;
  lastCommand: string | null;
}

export interface ClaudeCodeCommandResult {
  ok: boolean;
  output: string[];
  state: ClaudeCodeState;
  unlockedCommand?: string;
}

export function createInitialClaudeCodeState(): ClaudeCodeState {
  return {
    sessionStarted: false,
    hadPreviousSession: false,
    contextPercent: 0,
    permissionMode: "default",
    memoryFileCreated: false,
    hooks: [],
    mcpServers: [],
    agents: [],
    pendingEdit: false,
    costUsd: 0,
    lastCommand: null,
  };
}
