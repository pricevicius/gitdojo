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

/** Flags booleanas (sem valor), ex. --activate, --all. */
function hasFlag(tokens: string[], flag: string): boolean {
  return tokens.includes(flag);
}

function requireInstalled(state: WpState): WpCommandResult | null {
  if (!state.installed) {
    return fail(state, "Erro: o WordPress ainda não foi instalado (rode 'wp core install' primeiro).");
  }
  return null;
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
      case "plugin":
        return handleAsset("plugin", action, tokens, state);
      case "theme":
        return handleAsset("theme", action, tokens, state);
      case "user":
        return handleUser(action, tokens, state);
      case "language":
        return handleLanguage(tokens, state);
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

  if (action === "update") {
    const notInstalled = requireInstalled(state);
    if (notInstalled) return notInstalled;
    if (!state.coreUpdateAvailable) {
      return ok(state, ["O WordPress já está atualizado."]);
    }
    state.coreUpdateAvailable = false;
    return ok(state, ["Atualizando o WordPress...", "Sucesso: WordPress atualizado."], "wp core update");
  }

  return fail(state, `wp core: subcomando '${action}' não suportado`);
}

/** wp plugin e wp theme têm o mesmo shape de comandos (install/update), só o dicionário muda. */
function handleAsset(
  kind: "plugin" | "theme",
  action: string | undefined,
  tokens: string[],
  state: WpState
): WpCommandResult {
  const notInstalled = requireInstalled(state);
  if (notInstalled) return notInstalled;

  const assets = kind === "plugin" ? state.plugins : state.themes;

  if (action === "install") {
    const slug = tokens[3];
    if (!slug) return fail(state, `uso: wp ${kind} install <slug> [--activate]`);
    const activate = hasFlag(tokens, "--activate");
    if (activate && kind === "theme") {
      Object.values(state.themes).forEach((t) => {
        t.active = false;
      });
    }
    assets[slug] = { active: activate, version: "1.0.0", updateAvailable: false };
    return ok(
      state,
      [`Instalando ${kind} '${slug}'...`, "Sucesso: instalado" + (activate ? " e ativado." : ".")],
      activate ? `wp ${kind} install --activate` : `wp ${kind} install`
    );
  }

  if (action === "update") {
    const all = hasFlag(tokens, "--all");
    if (all) {
      const updated = Object.entries(assets).filter(([, a]) => a.updateAvailable);
      updated.forEach(([, a]) => {
        a.updateAvailable = false;
      });
      return ok(
        state,
        updated.length > 0
          ? updated.map(([slug]) => `Sucesso: '${slug}' atualizado.`)
          : ["Nenhuma atualização disponível."],
        `wp ${kind} update --all`
      );
    }

    const slug = tokens[3];
    if (!slug || !(slug in assets)) {
      return fail(state, `Erro: '${slug}' não está instalado.`);
    }
    assets[slug].updateAvailable = false;
    return ok(state, [`Sucesso: '${slug}' atualizado.`], `wp ${kind} update`);
  }

  return fail(state, `wp ${kind}: subcomando '${action}' não suportado`);
}

function handleUser(action: string | undefined, tokens: string[], state: WpState): WpCommandResult {
  const notInstalled = requireInstalled(state);
  if (notInstalled) return notInstalled;

  if (action !== "create") {
    return fail(state, `wp user: subcomando '${action}' não suportado`);
  }

  const login = tokens[3];
  const email = tokens[4];
  if (!login || !email) return fail(state, "uso: wp user create <login> <email> [--role=<papel>]");
  if (login in state.users) return fail(state, `Erro: o usuário '${login}' já existe.`);

  const flags = parseFlags(tokens);
  state.users[login] = { email, role: flags.role ?? "subscriber" };
  return ok(state, [`Sucesso: criado usuário ${login}.`], "wp user create");
}

function handleLanguage(tokens: string[], state: WpState): WpCommandResult {
  const notInstalled = requireInstalled(state);
  if (notInstalled) return notInstalled;

  if (tokens[2] !== "core" || tokens[3] !== "update") {
    return fail(state, "wp language: só 'core update' é suportado neste simulador ainda.");
  }
  if (!state.coreLanguageUpdateAvailable) {
    return ok(state, ["As traduções já estão atualizadas."]);
  }
  state.coreLanguageUpdateAvailable = false;
  return ok(state, ["Sucesso: traduções atualizadas."], "wp language core update");
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
