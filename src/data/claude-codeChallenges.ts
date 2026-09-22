import type { ClaudeCodeState } from "../engine/claude-code/types";
import { createInitialClaudeCodeState } from "../engine/claude-code/types";
import type { DojoChallenge } from "../dojo/types";

export type ClaudeCodeChallenge = DojoChallenge<ClaudeCodeState>;

export const CLAUDE_CODE_TRILHAS_ORDER = [
  "Fundamentos",
  "Contexto e Sessão",
  "Permissões",
  "Subagents e MCP",
  "Automação",
] as const;

function withSessionStarted(): ClaudeCodeState {
  const s = createInitialClaudeCodeState();
  s.sessionStarted = true;
  s.contextPercent = 3;
  return s;
}

function withPreviousSessionClosed(): ClaudeCodeState {
  const s = createInitialClaudeCodeState();
  s.hadPreviousSession = true;
  return s;
}

function withHighContext(): ClaudeCodeState {
  const s = withSessionStarted();
  s.contextPercent = 92;
  return s;
}

function withPendingEdit(): ClaudeCodeState {
  const s = withSessionStarted();
  s.pendingEdit = true;
  return s;
}

export const CLAUDE_CODE_CHALLENGES: ClaudeCodeChallenge[] = [
  // Fundamentos
  {
    id: "start-session-1",
    trilha: "Fundamentos",
    title: "Abra sua primeira sessão",
    description: "Você acabou de abrir o terminal e quer começar a conversar com o Claude Code. Inicie uma sessão.",
    hint: "O binário se chama 'claude' — chame ele sem nenhum argumento.",
    setup: () => createInitialClaudeCodeState(),
    goal: (s) => s.sessionStarted,
  },
  {
    id: "cost-1",
    trilha: "Fundamentos",
    title: "Veja quanto a sessão já custou",
    description: "No meio de uma sessão, você quer saber o custo acumulado até agora, sem interromper nada.",
    hint: "Existe um comando de barra que só mostra informação, sem mudar o estado da conversa.",
    setup: () => withSessionStarted(),
    goal: (s) => s.lastCommand === "/cost",
  },
  {
    id: "clear-1",
    trilha: "Fundamentos",
    title: "Comece do zero sem sair da sessão",
    description:
      "O contexto está cheio de coisa de uma tarefa anterior que não tem mais nada a ver com o que você vai fazer agora. Limpe a conversa.",
    hint: "Um comando de barra zera o histórico da conversa atual, mantendo a sessão aberta.",
    setup: () => withHighContext(),
    goal: (s) => s.contextPercent === 0,
  },

  // Contexto e Sessão
  {
    id: "compact-1",
    trilha: "Contexto e Sessão",
    title: "Contexto quase estourando",
    description:
      "A conversa está longa e o contexto está quase no limite, mas você ainda precisa do fio dela — diferente de limpar tudo, você só quer resumir o que já foi dito.",
    hint: "Existe um comando de barra que resume o histórico em vez de apagá-lo.",
    setup: () => withHighContext(),
    goal: (s) => s.contextPercent > 0 && s.contextPercent < 92,
  },
  {
    id: "continue-1",
    trilha: "Contexto e Sessão",
    title: "Continue de onde parou",
    description:
      "Você fechou o terminal ontem no meio de uma tarefa. Hoje quer continuar a mesma conversa, sem abrir uma sessão nova do zero.",
    hint: "Uma flag curta do binário 'claude' retoma a sessão mais recente.",
    setup: () => withPreviousSessionClosed(),
    goal: (s) => s.sessionStarted && s.lastCommand === "claude -c",
  },
  {
    id: "rewind-1",
    trilha: "Contexto e Sessão",
    title: "Desfaça a última edição",
    description:
      "O Claude acabou de editar um arquivo, mas o resultado não era bem o que você queria. Desfaça só essa edição, sem perder o resto da conversa.",
    hint: "Existe um comando de barra específico pra desfazer a última mudança feita na sessão.",
    setup: () => withPendingEdit(),
    goal: (s) => !s.pendingEdit,
  },

  // Permissões
  {
    id: "permissions-plan-1",
    trilha: "Permissões",
    title: "Revise antes de editar",
    description:
      "Você está prestes a pedir uma mudança em código sensível e quer ver o plano antes de qualquer edição ser aplicada.",
    hint: "O comando de permissões aceita um modo que mostra o plano sem tocar em arquivos.",
    setup: () => withSessionStarted(),
    goal: (s) => s.permissionMode === "plan",
  },
  {
    id: "permissions-accept-1",
    trilha: "Permissões",
    title: "Pare de confirmar cada edição",
    description: "Você já confia no que está pedindo e não quer aprovar arquivo por arquivo a cada mudança.",
    hint: "O mesmo comando de permissões tem um modo que aceita edições automaticamente.",
    setup: () => withSessionStarted(),
    goal: (s) => s.permissionMode === "acceptEdits",
  },
  {
    id: "skip-permissions-1",
    trilha: "Permissões",
    title: "Velocidade máxima num sandbox descartável",
    description:
      "Você está rodando isso dentro de um container isolado, sem nada de valor, e quer que tudo rode sem pedir confirmação nenhuma.",
    hint: "Existe uma flag do binário 'claude', de nome bem explícito sobre o risco, que já inicia a sessão nesse modo.",
    setup: () => createInitialClaudeCodeState(),
    goal: (s) => s.sessionStarted && s.permissionMode === "bypassPermissions",
  },

  // Subagents e MCP
  {
    id: "agents-create-1",
    trilha: "Subagents e MCP",
    title: "Crie um agente dedicado a revisar código",
    description:
      "Você quer um subagent separado da conversa principal, focado só em revisar as mudanças antes de aceitar.",
    hint: "Um comando de barra cria subagents novos, esperando um nome depois da ação 'create'.",
    setup: () => withSessionStarted(),
    goal: (s) => s.agents.length > 0,
  },
  {
    id: "mcp-add-1",
    trilha: "Subagents e MCP",
    title: "Conecte uma ferramenta externa",
    description: "Você quer que o Claude converse com um serviço externo (banco, Slack, etc.) através do protocolo MCP.",
    hint: "Um comando de barra dedicado a MCP tem uma ação que adiciona um servidor novo, esperando um nome.",
    setup: () => withSessionStarted(),
    goal: (s) => s.mcpServers.length > 0,
  },

  // Automação
  {
    id: "init-1",
    trilha: "Automação",
    title: "Pare de repetir instruções toda sessão",
    description:
      "Esse projeto não tem nenhuma instrução salva pro Claude — toda sessão nova começa do zero explicando o óbvio. Gere um arquivo de memória a partir do projeto.",
    hint: "Um comando de barra curto analisa o projeto e cria o CLAUDE.md.",
    setup: () => withSessionStarted(),
    goal: (s) => s.memoryFileCreated,
  },
  {
    id: "quick-memory-1",
    trilha: "Automação",
    title: "Salve uma preferência sem interromper a conversa",
    description:
      "No meio de uma tarefa, você quer registrar uma preferência (ex: 'sempre responda em português') pro Claude lembrar depois, sem parar pra editar arquivo.",
    hint: "Um prefixo de uma letra, no início da linha, salva memória rápida direto da conversa.",
    setup: () => withSessionStarted(),
    goal: (s) => s.lastCommand === "#" && s.memoryFileCreated,
  },
  {
    id: "hooks-add-1",
    trilha: "Automação",
    title: "Rode o linter automaticamente após cada edição",
    description: "Você quer que um comando rode sozinho toda vez que o Claude terminar de editar um arquivo, sem precisar pedir.",
    hint: "Um comando de barra dedicado a hooks registra automações para eventos como 'PostToolUse'.",
    setup: () => withSessionStarted(),
    goal: (s) => s.hooks.length > 0,
  },
];
