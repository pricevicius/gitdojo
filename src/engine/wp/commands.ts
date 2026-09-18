import type { WpCommandResult, WpState } from "./types";

function clone(state: WpState): WpState {
  return JSON.parse(JSON.stringify(state)) as WpState;
}

function fail(state: WpState, ...lines: string[]): WpCommandResult {
  return { ok: false, output: lines, state };
}

function ok(state: WpState, lines: string[], unlockedCommand?: string): WpCommandResult {
  return { ok: true, output: lines, state, unlockedCommand };
}

/**
 * Ao contrário do tokenizer do engine de git, aqui os valores entre aspas
 * quase sempre vêm colados a uma flag (--title="Meu Site"), não isolados
 * como em `-m "mensagem"`. Por isso cada token é uma sequência sem espaço
 * que pode conter um trecho entre aspas no meio (a aspa some do resultado
 * só depois, em parseFlags).
 */
function tokenize(input: string): string[] {
  const matches = input.trim().match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g);
  return matches ?? [];
}

/** Extrai flags no formato --chave=valor (com ou sem aspas) em um mapa. */
function parseFlags(tokens: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const token of tokens) {
    if (!token.startsWith("--")) continue;
    const eq = token.indexOf("=");
    if (eq === -1) continue;
    const key = token.slice(2, eq);
    let value = token.slice(eq + 1);
    const quoted = value.match(/^"([^"]*)"$|^'([^']*)'$/);
    if (quoted) value = quoted[1] ?? quoted[2] ?? "";
    flags[key] = value;
  }
  return flags;
}

function requireFlags(flags: Record<string, string>, keys: string[]): string | null {
  const missing = keys.filter((k) => !flags[k]);
  if (missing.length === 0) return null;
  return `faltam flags obrigatórias: ${missing.map((k) => `--${k}`).join(", ")}`;
}

export function runCommand(rawInput: string, prev: WpState): WpCommandResult {
  const input = rawInput.trim();
  if (!input) return fail(prev, "");

  const tokens = tokenize(input);
  if (tokens[0] !== "wp") {
    return fail(prev, `comando não reconhecido: ${tokens[0]}`, "dica: todo comando começa com 'wp'");
  }

  const sub = tokens[1];
  const action = tokens[2];
  const state = clone(prev);

  const result = (() => {
    switch (sub) {
      case "core":
        return handleCore(action, tokens, state);
      case "config":
        return handleConfig(action, tokens, state);
      case "db":
        return handleDb(action, state);
      default:
        return fail(state, `wp: '${sub}' não é um comando suportado neste simulador ainda.`);
    }
  })();

  if (result.ok) {
    result.state.lastCommand = `${sub}${action ? ` ${action}` : ""}`;
  }
  return result;
}

function handleCore(action: string | undefined, tokens: string[], state: WpState): WpCommandResult {
  if (action === "download") {
    if (state.downloaded) {
      return ok(state, ["Os arquivos do WordPress já foram baixados."]);
    }
    state.downloaded = true;
    return ok(state, ["Baixando WordPress...", "Sucesso: WordPress baixado."], "wp core download");
  }

  if (action === "install") {
    if (!state.dbCreated) {
      return fail(state, "Erro: o banco de dados ainda não existe (rode 'wp db create' primeiro).");
    }
    const flags = parseFlags(tokens);
    const missing = requireFlags(flags, ["url", "title", "admin_user", "admin_password", "admin_email"]);
    if (missing) return fail(state, `Erro: ${missing}`);

    state.installed = true;
    state.site = {
      url: flags.url,
      title: flags.title,
      adminUser: flags.admin_user,
      adminEmail: flags.admin_email,
    };
    return ok(state, [`Sucesso: WordPress instalado em ${flags.url}.`], "wp core install");
  }

  if (action === "is-installed") {
    if (!state.installed) return fail(state, "");
    return ok(state, [], "wp core is-installed");
  }

  if (action === "version") {
    return ok(state, ["6.4.3"], "wp core version");
  }

  return fail(state, `wp core: subcomando '${action}' não suportado`);
}

function handleConfig(action: string | undefined, tokens: string[], state: WpState): WpCommandResult {
  if (action !== "create") {
    return fail(state, `wp config: subcomando '${action}' não suportado`);
  }
  if (!state.downloaded) {
    return fail(state, "Erro: os arquivos do WordPress ainda não foram baixados (rode 'wp core download' primeiro).");
  }
  const flags = parseFlags(tokens);
  const missing = requireFlags(flags, ["dbname", "dbuser", "dbpass"]);
  if (missing) return fail(state, `Erro: ${missing}`);

  state.config = { dbName: flags.dbname, dbUser: flags.dbuser, dbPass: flags.dbpass };
  return ok(state, ["Sucesso: wp-config.php criado."], "wp config create");
}

function handleDb(action: string | undefined, state: WpState): WpCommandResult {
  if (action !== "create") {
    return fail(state, `wp db: subcomando '${action}' não suportado`);
  }
  if (!state.config) {
    return fail(state, "Erro: ainda não existe wp-config.php (rode 'wp config create' primeiro).");
  }
  if (state.dbCreated) {
    return ok(state, ["O banco de dados já existe."]);
  }
  state.dbCreated = true;
  return ok(state, [`Sucesso: banco de dados '${state.config.dbName}' criado.`], "wp db create");
}
