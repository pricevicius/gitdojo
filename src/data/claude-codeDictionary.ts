import type { DictionaryEntry } from "../dojo/types";

export const CLAUDE_CODE_DICTIONARY: Record<string, DictionaryEntry> = {
  claude: {
    command: "claude",
    category: "Fundamentos",
    short: "Inicia uma sessão interativa do Claude Code no diretório atual.",
    example: "claude",
  },
  "claude -p": {
    command: 'claude -p "<prompt>"',
    category: "Fundamentos",
    short: "Roda uma instrução única, sem sessão interativa — útil em scripts e pipelines.",
    example: 'claude -p "resuma as mudanças deste diff"',
  },
  "/cost": {
    command: "/cost",
    category: "Fundamentos",
    short: "Mostra o custo acumulado da sessão atual, sem alterar nada.",
    example: "/cost",
  },
  "/clear": {
    command: "/clear",
    category: "Fundamentos",
    short: "Zera o histórico da conversa atual, mantendo a sessão aberta.",
    example: "/clear",
  },
  "/compact": {
    command: "/compact",
    category: "Contexto e Sessão",
    short: "Resume o histórico da conversa para liberar espaço de contexto, sem apagar tudo como o /clear.",
    example: "/compact",
  },
  "claude -c": {
    command: "claude -c",
    category: "Contexto e Sessão",
    short: "Continua a sessão mais recente, mesmo depois de fechar o terminal.",
    example: "claude -c",
  },
  "claude --resume": {
    command: "claude --resume <id>",
    category: "Contexto e Sessão",
    short: "Retoma uma sessão específica pelo id, quando há mais de uma sessão anterior.",
    example: "claude --resume abc123",
  },
  "/resume": {
    command: "/resume",
    category: "Contexto e Sessão",
    short: "Troca para outra sessão sem sair do terminal atual.",
    example: "/resume",
  },
  "/rewind": {
    command: "/rewind",
    category: "Contexto e Sessão",
    short: "Desfaz a última edição feita pelo Claude, mantendo o resto da conversa intacto.",
    example: "/rewind",
  },
  "/permissions": {
    command: "/permissions <default|plan|acceptEdits>",
    category: "Permissões",
    short: "Troca o modo de permissão da sessão — quanto o Claude pode fazer sem pedir confirmação.",
    example: "/permissions plan",
  },
  "claude --dangerously-skip-permissions": {
    command: "claude --dangerously-skip-permissions",
    category: "Permissões",
    short: "Inicia a sessão sem checar nenhuma permissão — todo comando roda automaticamente. Só em ambiente descartável.",
    example: "claude --dangerously-skip-permissions",
  },
  "/agents create": {
    command: "/agents create <nome>",
    category: "Subagents e MCP",
    short: "Cria um subagent com um propósito próprio, separado do assistente principal da sessão.",
    example: "/agents create revisor",
  },
  "/mcp add": {
    command: "/mcp add <nome>",
    category: "Subagents e MCP",
    short: "Conecta um servidor MCP, dando ao Claude acesso a uma ferramenta ou dado externo.",
    example: "/mcp add postgres",
  },
  "/init": {
    command: "/init",
    category: "Automação",
    short: "Analisa o projeto e gera um CLAUDE.md com instruções persistentes pra toda sessão futura.",
    example: "/init",
  },
  "#": {
    command: "#<nota>",
    category: "Automação",
    short: "Salva uma preferência no CLAUDE.md direto da conversa, sem editar o arquivo manualmente.",
    example: "# sempre responda em português",
  },
  "/hooks add": {
    command: "/hooks add <evento>",
    category: "Automação",
    short: "Registra uma automação que roda sozinha quando o evento acontece (ex: depois de uma edição).",
    example: "/hooks add PostToolUse",
  },
  "!": {
    command: "!<comando>",
    category: "Automação",
    short: "Roda um comando de shell direto, sem sair da sessão do Claude.",
    example: "!npm test",
  },
  "@": {
    command: "@<arquivo>",
    category: "Automação",
    short: "Referencia um arquivo específico, adicionando o conteúdo dele ao contexto da conversa.",
    example: "@src/App.tsx",
  },
};
