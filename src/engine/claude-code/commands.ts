import type { ClaudeCodeCommandResult, ClaudeCodeState, PermissionMode } from "./types";

function clone(state: ClaudeCodeState): ClaudeCodeState {
  return JSON.parse(JSON.stringify(state)) as ClaudeCodeState;
}

function fail(state: ClaudeCodeState, ...lines: string[]): ClaudeCodeCommandResult {
  return { ok: false, output: lines, state };
}

function ok(state: ClaudeCodeState, lines: string[], unlockedCommand?: string): ClaudeCodeCommandResult {
  return { ok: true, output: lines, state, unlockedCommand };
}

const PERMISSION_MODES: PermissionMode[] = ["default", "plan", "acceptEdits"];

/**
 * Diferente do git e do wp-cli, aqui não existe um recurso externo (repo, site)
 * pra simular — o "estado" é a própria sessão do terminal. Por isso o parser
 * tem dois modos: fora de uma sessão, só o binário `claude` (com suas flags)
 * é reconhecido; dentro da sessão, os comandos reais do dia a dia são
 * digitados direto, sem prefixo (`/clear`, `!ls`, `@arquivo`, `# nota`).
 */
export function runCommand(rawInput: string, prev: ClaudeCodeState): ClaudeCodeCommandResult {
  const input = rawInput.trim();
  if (!input) return fail(prev, "");

  const state = clone(prev);
  const result = state.sessionStarted ? handleSession(input, state) : handleShell(input, state);

  if (result.ok && result.unlockedCommand) {
    result.state.lastCommand = result.unlockedCommand;
  }
  return result;
}

function tokenize(input: string): string[] {
  const matches = input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g);
  return matches ?? [];
}

function handleShell(input: string, state: ClaudeCodeState): ClaudeCodeCommandResult {
  const tokens = tokenize(input);
  if (tokens[0] !== "claude") {
    return fail(
      state,
      `comando não reconhecido: ${tokens[0]}`,
      "dica: fora de uma sessão, todo comando começa com 'claude'."
    );
  }

  const flag = tokens[1];

  if (!flag) {
    state.sessionStarted = true;
    state.contextPercent = 3;
    return ok(state, ["Sessão iniciada.", "Digite uma instrução, ou use /clear, /compact, /permissions..."], "claude");
  }

  if (flag === "-p") {
    const prompt = tokens.slice(2).join(" ").replace(/^["']|["']$/g, "");
    if (!prompt) return fail(state, 'uso: claude -p "seu prompt"');
    state.costUsd = round(state.costUsd + 0.02);
    return ok(state, [`(resposta de uma execução única, sem abrir sessão)`], "claude -p");
  }

  if (flag === "-c" || flag === "--continue") {
    if (!state.hadPreviousSession) {
      return fail(state, "Erro: não há sessão anterior para continuar.");
    }
    state.sessionStarted = true;
    return ok(state, ["Sessão anterior retomada."], "claude -c");
  }

  if (flag === "--resume") {
    const id = tokens[2];
    if (!id) return fail(state, "uso: claude --resume <id-da-sessão>");
    if (!state.hadPreviousSession) {
      return fail(state, `Erro: nenhuma sessão encontrada com id '${id}'.`);
    }
    state.sessionStarted = true;
    return ok(state, [`Sessão '${id}' retomada.`], "claude --resume");
  }

  if (flag === "--dangerously-skip-permissions") {
    state.sessionStarted = true;
    state.permissionMode = "bypassPermissions";
    return ok(
      state,
      [
        "Sessão iniciada SEM checagem de permissões.",
        "Todo comando roda automaticamente, sem confirmação — use só em ambiente descartável/sandbox.",
      ],
      "claude --dangerously-skip-permissions"
    );
  }

  return fail(state, `claude: flag '${flag}' não suportada neste simulador ainda.`);
}

function handleSession(input: string, state: ClaudeCodeState): ClaudeCodeCommandResult {
  if (input.startsWith("/")) return handleSlash(input, state);
  if (input.startsWith("!")) return handleBash(input, state);
  if (input.startsWith("@")) return handleMention(input, state);
  if (input.startsWith("#")) return handleMemory(input, state);
  return handlePrompt(state);
}

function handleSlash(input: string, state: ClaudeCodeState): ClaudeCodeCommandResult {
  const tokens = input.split(/\s+/);
  const cmd = tokens[0];

  switch (cmd) {
    case "/clear":
      state.contextPercent = 0;
      state.pendingEdit = false;
      return ok(state, ["Conversa limpa. Contexto zerado."], "/clear");

    case "/compact": {
      if (state.contextPercent === 0) {
        return ok(state, ["Nada para compactar — o contexto já está vazio."]);
      }
      state.contextPercent = Math.round(state.contextPercent * 0.2);
      return ok(state, ["Resumindo o histórico da conversa...", `Contexto reduzido para ${state.contextPercent}%.`], "/compact");
    }

    case "/cost":
      return ok(state, [`Custo desta sessão: $${state.costUsd.toFixed(2)}`], "/cost");

    case "/init":
      if (state.memoryFileCreated) return ok(state, ["CLAUDE.md já existe neste projeto."]);
      state.memoryFileCreated = true;
      return ok(state, ["Analisando o projeto...", "Sucesso: CLAUDE.md criado."], "/init");

    case "/permissions": {
      const mode = tokens[1];
      if (!mode || !PERMISSION_MODES.includes(mode as PermissionMode)) {
        return fail(state, `uso: /permissions <${PERMISSION_MODES.join("|")}>`);
      }
      state.permissionMode = mode as PermissionMode;
      return ok(state, [`Modo de permissão agora é '${mode}'.`], "/permissions");
    }

    case "/agents": {
      const name = tokens[2];
      if (tokens[1] !== "create" || !name) return fail(state, "uso: /agents create <nome>");
      if (!state.agents.includes(name)) state.agents.push(name);
      return ok(state, [`Subagent '${name}' criado.`], "/agents create");
    }

    case "/mcp": {
      const name = tokens[2];
      if (tokens[1] !== "add" || !name) return fail(state, "uso: /mcp add <nome>");
      if (!state.mcpServers.includes(name)) state.mcpServers.push(name);
      return ok(state, [`Servidor MCP '${name}' conectado.`], "/mcp add");
    }

    case "/hooks": {
      const event = tokens[2];
      if (tokens[1] !== "add" || !event) return fail(state, "uso: /hooks add <evento>");
      if (!state.hooks.includes(event)) state.hooks.push(event);
      return ok(state, [`Hook registrado para o evento '${event}'.`], "/hooks add");
    }

    case "/rewind":
      if (!state.pendingEdit) return fail(state, "Nada para desfazer — nenhuma edição pendente nesta sessão.");
      state.pendingEdit = false;
      return ok(state, ["Última edição desfeita. O resto da conversa continua intacto."], "/rewind");

    case "/resume":
      if (!state.hadPreviousSession) return fail(state, "Erro: não há outra sessão para retomar.");
      return ok(state, ["Sessão trocada para a mais recente."], "/resume");

    default:
      return fail(state, `${cmd}: comando não suportado neste simulador ainda.`);
  }
}

function handleBash(input: string, state: ClaudeCodeState): ClaudeCodeCommandResult {
  const cmdText = input.slice(1).trim();
  if (!cmdText) return fail(state, "uso: !<comando> — roda um comando de shell sem sair da sessão.");
  state.contextPercent = Math.min(100, state.contextPercent + 2);
  return ok(state, [`$ ${cmdText}`, "(a saída do comando real apareceria aqui)"], "!");
}

function handleMention(input: string, state: ClaudeCodeState): ClaudeCodeCommandResult {
  const file = input.slice(1).trim();
  if (!file) return fail(state, "uso: @<arquivo> — adiciona um arquivo ao contexto da conversa.");
  state.contextPercent = Math.min(100, state.contextPercent + 5);
  return ok(state, [`Arquivo '${file}' adicionado ao contexto.`], "@");
}

function handleMemory(input: string, state: ClaudeCodeState): ClaudeCodeCommandResult {
  const note = input.slice(1).trim();
  if (!note) return fail(state, "uso: #<nota> — salva uma preferência no CLAUDE.md sem interromper a conversa.");
  state.memoryFileCreated = true;
  return ok(state, [`Memória adicionada ao CLAUDE.md: "${note}"`], "#");
}

function handlePrompt(state: ClaudeCodeState): ClaudeCodeCommandResult {
  state.contextPercent = Math.min(100, state.contextPercent + 8);
  state.costUsd = round(state.costUsd + 0.03);
  state.pendingEdit = true;
  return ok(state, ["Claude está pensando...", "(resposta simulada — este simulador não chama a API de verdade)"]);
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
