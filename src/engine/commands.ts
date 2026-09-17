import type { CommandResult, Commit, RepoState } from "./types";

function clone(state: RepoState): RepoState {
  return JSON.parse(JSON.stringify(state)) as RepoState;
}

function currentCommit(state: RepoState): string | null {
  if (state.head.type === "detached") return state.head.commit;
  return state.branches[state.head.name] ?? null;
}

function fail(state: RepoState, ...lines: string[]): CommandResult {
  return { ok: false, output: lines, state };
}

function ok(
  state: RepoState,
  lines: string[],
  unlockedCommand?: string
): CommandResult {
  return { ok: true, output: lines, state, unlockedCommand };
}

/** Extracts a quoted or bare argument after a flag, e.g. -m "msg" or -m msg */
function extractMessage(tokens: string[], flag: string): string | null {
  const idx = tokens.indexOf(flag);
  if (idx === -1 || idx + 1 >= tokens.length) return null;
  const rest = tokens.slice(idx + 1).join(" ");
  const quoted = rest.match(/^"([^"]*)"|^'([^']*)'/);
  if (quoted) return quoted[1] ?? quoted[2] ?? "";
  return tokens[idx + 1];
}

function tokenize(input: string): string[] {
  const matches = input.trim().match(/"[^"]*"|'[^']*'|\S+/g);
  return matches ?? [];
}

export function runCommand(rawInput: string, prev: RepoState): CommandResult {
  const input = rawInput.trim();
  if (!input) return fail(prev, "");

  const tokens = tokenize(input);
  if (tokens[0] !== "git") {
    return fail(prev, `comando não reconhecido: ${tokens[0]}`, "dica: todo comando começa com 'git'");
  }

  const sub = tokens[1];
  const state = clone(prev);

  const result = (() => {
    switch (sub) {
      case "init":
        return handleInit(state);
      case "status":
        return handleStatus(state);
      case "add":
        return handleAdd(tokens, state);
      case "commit":
        return handleCommit(tokens, state);
      case "log":
        return handleLog(state);
      case "branch":
        return handleBranch(tokens, state);
      case "checkout":
        return handleCheckout(tokens, state);
      case "switch":
        return handleSwitch(tokens, state);
      case "merge":
        return handleMerge(tokens, state);
      case "tag":
        return handleTag(tokens, state);
      case "restore":
        return handleRestore(tokens, state);
      case "reset":
        return handleReset(tokens, state);
      case "revert":
        return handleRevert(tokens, state);
      case "remote":
        return handleRemote(tokens, state);
      case "push":
        return handlePush(tokens, state);
      case "fetch":
        return handleFetch(tokens, state);
      case "pull":
        return handlePull(tokens, state);
      case "clone":
        return handleClone(tokens, state);
      default:
        return fail(state, `git: '${sub}' não é um comando suportado neste simulador ainda.`);
    }
  })();

  if (result.ok) {
    result.state.lastCommand = sub;
  }
  return result;
}

function requireInit(state: RepoState): CommandResult | null {
  if (!state.initialized) {
    return fail(state, "fatal: não é um repositório git (rode 'git init' primeiro)");
  }
  return null;
}

function handleInit(state: RepoState): CommandResult {
  if (state.initialized) {
    return ok(state, ["Repositório Git existente reinicializado."]);
  }
  state.initialized = true;
  state.branches["main"] = null;
  state.head = { type: "branch", name: "main" };
  return ok(state, ["Repositório Git vazio inicializado em ./.git/"], "git init");
}

function handleStatus(state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  const lines: string[] = [];
  lines.push(
    state.head.type === "branch"
      ? `Na branch ${state.head.name}`
      : `HEAD destacado em ${state.head.commit.slice(0, 7)}`
  );
  if (state.staged.length === 0 && state.workingChanges.length === 0) {
    lines.push("nada a commitar, árvore de trabalho limpa");
  } else {
    if (state.staged.length > 0) {
      lines.push("Alterações preparadas para commit:");
      state.staged.forEach((f) => lines.push(`  novo arquivo:   ${f}`));
    }
    if (state.workingChanges.length > 0) {
      lines.push("Alterações não preparadas para commit:");
      state.workingChanges.forEach((f) => lines.push(`  modificado:   ${f}`));
    }
  }
  return ok(state, lines, "git status");
}

function handleAdd(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  const arg = tokens[2];
  if (!arg) return fail(state, "Nada especificado, nada adicionado.");

  if (state.workingChanges.length === 0) {
    return fail(state, "Nada para adicionar: não há alterações pendentes.");
  }

  if (arg === ".") {
    state.staged.push(...state.workingChanges);
    state.workingChanges = [];
  } else {
    const i = state.workingChanges.indexOf(arg);
    if (i === -1) {
      return fail(state, `fatal: pathspec '${arg}' não corresponde a nenhum arquivo`);
    }
    state.workingChanges.splice(i, 1);
    state.staged.push(arg);
  }
  return ok(state, [], "git add");
}

function handleCommit(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  if (state.head.type === "detached") {
    return fail(state, "não é possível commitar em HEAD destacado neste tutorial (faça checkout de uma branch)");
  }

  if (!tokens.includes("-m")) {
    return fail(state, "erro: use 'git commit -m \"mensagem\"'");
  }
  const message = extractMessage(tokens, "-m");
  if (!message) {
    return fail(state, "Commit abortado: mensagem vazia.");
  }
  if (state.staged.length === 0) {
    return fail(state, "nada preparado para commit (use 'git add')");
  }

  const parentId = currentCommit(state);
  state.commitCounter += 1;
  const id = `c${state.commitCounter}`;
  state.commits[id] = {
    id,
    parentIds: parentId ? [parentId] : [],
    message,
    createdOnBranch: state.head.name,
  };
  state.branches[state.head.name] = id;
  state.staged = [];

  return ok(
    state,
    [`[${state.head.name} ${id}] ${message}`],
    "git commit"
  );
}

function handleLog(state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  const lines: string[] = [];
  let cursor: string | null = currentCommit(state);
  if (!cursor) {
    return fail(state, "fatal: sua branch atual ainda não tem nenhum commit");
  }
  while (cursor) {
    const c: Commit = state.commits[cursor];
    lines.push(`commit ${c.id}`);
    lines.push(`    ${c.message}`);
    cursor = c.parentIds[0] ?? null;
  }
  return ok(state, lines, "git log");
}

function handleBranch(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  if (tokens.includes("-d") || tokens.includes("-D")) {
    const force = tokens.includes("-D");
    const flagIdx = tokens.findIndex((t) => t === "-d" || t === "-D");
    const name = tokens[flagIdx + 1];
    if (!name) return fail(state, "especifique o nome da branch a deletar");
    if (!(name in state.branches)) {
      return fail(state, `error: branch '${name}' não encontrada.`);
    }
    if (state.head.type === "branch" && state.head.name === name) {
      return fail(state, `error: não é possível deletar a branch '${name}': você está nela agora`);
    }
    const tip = state.branches[name];
    const head = currentCommit(state);
    if (!force && tip && head && !isAncestor(state, tip, head)) {
      return fail(
        state,
        `error: a branch '${name}' não foi totalmente mesclada.`,
        `Se tiver certeza que quer deletá-la, rode 'git branch -D ${name}'.`
      );
    }
    delete state.branches[name];
    return ok(state, [`Branch ${name} deletada.`], "git branch -d");
  }

  const name = tokens[2];
  if (!name) {
    const lines = Object.keys(state.branches).map((b) => {
      const current = state.head.type === "branch" && state.head.name === b;
      return `${current ? "* " : "  "}${b}`;
    });
    return ok(state, lines, "git branch");
  }

  if (name in state.branches) {
    return fail(state, `fatal: já existe uma branch chamada '${name}'.`);
  }
  const cur = currentCommit(state);
  state.branches[name] = cur;
  return ok(state, [], "git branch");
}

function handleCheckout(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  if (tokens[2] === "-b") {
    const name = tokens[3];
    if (!name) return fail(state, "especifique o nome da nova branch");
    if (name in state.branches) {
      return fail(state, `fatal: já existe uma branch chamada '${name}'.`);
    }
    state.branches[name] = currentCommit(state);
    state.head = { type: "branch", name };
    return ok(state, [`Trocou para uma nova branch '${name}'`], "git checkout -b");
  }

  const name = tokens[2];
  if (!name) return fail(state, "especifique uma branch");
  if (name in state.branches) {
    state.head = { type: "branch", name };
    return ok(state, [`Trocou para a branch '${name}'`], "git checkout");
  }
  if (name in state.commits) {
    state.head = { type: "detached", commit: name };
    return ok(
      state,
      [
        `Nota: trocando para '${name}'.`,
        "",
        "Você está em estado de 'HEAD destacado'. Pode olhar ao redor, fazer",
        "alterações experimentais e commitá-las, e pode descartar qualquer commit",
        "feito nesse estado sem afetar nenhuma branch, bastando voltar para uma.",
        "",
        `HEAD agora está em ${name.slice(0, 7)}`,
      ],
      "git checkout (detached)"
    );
  }
  return fail(state, `error: pathspec '${name}' não corresponde a nenhum arquivo conhecido pelo git`);
}

function handleSwitch(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  if (tokens[2] === "-c") {
    const name = tokens[3];
    if (!name) return fail(state, "especifique o nome da nova branch");
    if (name in state.branches) {
      return fail(state, `fatal: já existe uma branch chamada '${name}'.`);
    }
    state.branches[name] = currentCommit(state);
    state.head = { type: "branch", name };
    return ok(state, [`Trocou para uma nova branch '${name}'`], "git switch -c");
  }

  const name = tokens[2];
  if (!name) return fail(state, "especifique uma branch");
  if (!(name in state.branches)) {
    return fail(state, `fatal: referência inválida: ${name}`);
  }
  state.head = { type: "branch", name };
  return ok(state, [`Trocou para a branch '${name}'`], "git switch");
}

/** True se `ancestorId` for alcançável a partir de `descendantId` seguindo os pais. */
function isAncestor(state: RepoState, ancestorId: string, descendantId: string): boolean {
  const seen = new Set<string>();
  const stack = [descendantId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === ancestorId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const commit = state.commits[id];
    if (commit) stack.push(...commit.parentIds);
  }
  return false;
}

/** Primeiro argumento posicional de `git merge`, ignorando flags e o valor de -m. */
function mergeTarget(tokens: string[]): string | null {
  const rest = tokens.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === "-m") {
      i += 1;
      continue;
    }
    if (token.startsWith("-")) continue;
    return token;
  }
  return null;
}

/**
 * Núcleo compartilhado de `git merge` e `git pull`: decide entre "already up
 * to date", fast-forward ou commit de merge, e aplica o resultado em `into`.
 */
function mergeInto(
  state: RepoState,
  into: string,
  targetTip: string | null,
  tokens: string[],
  sourceLabel: string,
  unlockedCommand: string
): CommandResult {
  if (!targetTip) {
    return ok(state, ["Já está tudo atualizado."], unlockedCommand);
  }

  const currentTip = currentCommit(state);

  // A outra ponta já está inteira no histórico atual: não há o que trazer.
  if (currentTip && isAncestor(state, targetTip, currentTip)) {
    return ok(state, ["Já está tudo atualizado."], unlockedCommand);
  }

  // Fast-forward: a branch atual não tem nenhum commit que a outra já não tenha,
  // então basta avançar o ponteiro — nenhum commit novo é criado.
  const noFf = tokens.includes("--no-ff");
  if (!currentTip || (!noFf && isAncestor(state, currentTip, targetTip))) {
    state.branches[into] = targetTip;
    return ok(
      state,
      currentTip
        ? [`Atualizando ${currentTip}..${targetTip}`, "Avanço rápido (fast-forward)"]
        : [`Atualizando ${targetTip}`, "Avanço rápido (fast-forward)"],
      unlockedCommand
    );
  }

  // Históricos divergiram: nasce um commit de merge, com os dois tips como pais.
  const message = extractMessage(tokens, "-m") ?? `Merge ${sourceLabel} into ${into}`;
  state.commitCounter += 1;
  const id = `c${state.commitCounter}`;
  state.commits[id] = {
    id,
    parentIds: [currentTip, targetTip],
    message,
    createdOnBranch: into,
  };
  state.branches[into] = id;

  return ok(
    state,
    [`Merge feito com a estratégia 'ort'.`, `[${into} ${id}] ${message}`],
    unlockedCommand
  );
}

function handleMerge(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  if (state.head.type === "detached") {
    return fail(state, "não é possível fazer merge em HEAD destacado neste tutorial (faça checkout de uma branch)");
  }

  const name = mergeTarget(tokens);
  if (!name) {
    return fail(state, "especifique a branch a ser incorporada (ex: git merge feature-login)");
  }
  if (!(name in state.branches)) {
    return fail(state, `merge: ${name} - não é algo que dá pra mesclar`);
  }

  const into = state.head.name;
  if (name === into) {
    return fail(state, `fatal: não é possível fazer merge de '${name}' nela mesma`);
  }

  const targetTip = state.branches[name];
  return mergeInto(state, into, targetTip, tokens, `branch '${name}'`, "git merge");
}

function handleTag(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  const cur = currentCommit(state);
  if (!cur) return fail(state, "fatal: não há commits para marcar com tag");

  if (tokens.includes("-a")) {
    const aIdx = tokens.indexOf("-a");
    const name = tokens[aIdx + 1];
    if (!name) return fail(state, "especifique o nome da tag");
    const message = extractMessage(tokens, "-m") ?? "";
    if (name in state.tags) return fail(state, `fatal: a tag '${name}' já existe`);
    state.tags[name] = { commit: cur, message, annotated: true };
    return ok(state, [], "git tag -a");
  }

  const name = tokens[2];
  if (!name) {
    return ok(state, Object.keys(state.tags), "git tag");
  }
  if (name in state.tags) return fail(state, `fatal: a tag '${name}' já existe`);
  state.tags[name] = { commit: cur, annotated: false };
  return ok(state, [], "git tag");
}

function handleRestore(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  const staged = tokens.includes("--staged");
  const arg = tokens.slice(2).find((t) => !t.startsWith("-"));
  if (!arg) return fail(state, "especifique o arquivo (ex: git restore index.js)");

  if (staged) {
    const i = state.staged.indexOf(arg);
    if (i === -1) {
      return fail(state, `error: pathspec '${arg}' não corresponde a nenhum arquivo conhecido pelo git`);
    }
    state.staged.splice(i, 1);
    state.workingChanges.push(arg);
    return ok(state, [], "git restore --staged");
  }

  const i = state.workingChanges.indexOf(arg);
  if (i === -1) {
    return fail(state, `error: pathspec '${arg}' não corresponde a nenhum arquivo conhecido pelo git`);
  }
  state.workingChanges.splice(i, 1);
  return ok(state, [], "git restore");
}

/** Resolve o alvo de `git reset` (id de commit ou HEAD~N) a partir dos tokens. */
function resetTargetCommit(state: RepoState, tokens: string[]): string | null {
  const arg = tokens.slice(2).find((t) => !t.startsWith("-"));
  if (!arg) return null;
  if (arg in state.commits) return arg;
  if (arg === "HEAD") return currentCommit(state);

  const m = arg.match(/^HEAD~(\d+)$/);
  if (!m) return null;
  let cursor = currentCommit(state);
  let steps = parseInt(m[1], 10);
  while (steps > 0 && cursor) {
    cursor = state.commits[cursor]?.parentIds[0] ?? null;
    steps -= 1;
  }
  return cursor;
}

function handleReset(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  if (state.head.type === "detached") {
    return fail(state, "não é possível fazer reset de branch em HEAD destacado neste tutorial (faça checkout de uma branch)");
  }

  const target = resetTargetCommit(state, tokens);
  if (!target) {
    return fail(
      state,
      "fatal: argumento ambíguo: revisão desconhecida ou caminho que não está na árvore de trabalho."
    );
  }

  const mode = tokens.includes("--hard") ? "hard" : tokens.includes("--soft") ? "soft" : "mixed";
  state.branches[state.head.name] = target;

  if (mode === "mixed") {
    state.workingChanges = [...state.workingChanges, ...state.staged];
    state.staged = [];
  } else if (mode === "hard") {
    state.staged = [];
    state.workingChanges = [];
  }
  // --soft: staged e workingChanges continuam como estavam.

  return ok(state, [`HEAD agora está em ${target.slice(0, 7)}`], `git reset --${mode}`);
}

function handleRevert(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  if (state.head.type === "detached") {
    return fail(state, "não é possível reverter em HEAD destacado neste tutorial (faça checkout de uma branch)");
  }

  const targetId = tokens[2];
  if (!targetId) return fail(state, "especifique o commit a reverter (ex: git revert c2)");
  const target = state.commits[targetId];
  if (!target) return fail(state, `fatal: revisão inválida '${targetId}'`);

  const cur = currentCommit(state);
  if (!cur) return fail(state, "fatal: sua branch atual ainda não tem nenhum commit");

  state.commitCounter += 1;
  const id = `c${state.commitCounter}`;
  const message = `Revert "${target.message}"`;
  state.commits[id] = {
    id,
    parentIds: [cur],
    message,
    createdOnBranch: state.head.name,
  };
  state.branches[state.head.name] = id;

  return ok(state, [`[${state.head.name} ${id}] ${message}`], "git revert");
}

function remoteRef(remote: string, branch: string): string {
  return `${remote}/${branch}`;
}

function handleRemote(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  if (tokens[2] === "add") {
    const name = tokens[3];
    const url = tokens[4];
    if (!name || !url) return fail(state, "uso: git remote add <nome> <url>");
    if (name in state.remotes) return fail(state, `fatal: o remote ${name} já existe.`);
    state.remotes[name] = url;
    return ok(state, [], "git remote add");
  }

  if (!tokens[2] || tokens[2] === "-v") {
    const lines = Object.entries(state.remotes).flatMap(([name, url]) => [
      `${name}\t${url} (fetch)`,
      `${name}\t${url} (push)`,
    ]);
    return ok(state, lines);
  }

  return fail(state, `git remote: subcomando '${tokens[2]}' não suportado`);
}

/** Extrai remoto e branch dos argumentos de push/pull, com fallback pro upstream configurado. */
function resolveRemoteAndBranch(
  tokens: string[],
  state: RepoState,
  branchName: string
): { remoteName: string; remoteBranch: string } | CommandResult {
  const positional = tokens.slice(2).filter((t) => !t.startsWith("-"));
  if (positional.length >= 2) {
    return { remoteName: positional[0], remoteBranch: positional[1] };
  }
  if (positional.length === 1) {
    return { remoteName: positional[0], remoteBranch: branchName };
  }
  const up = state.upstream[branchName];
  if (!up) {
    return fail(
      state,
      `fatal: a branch atual ${branchName} não tem upstream configurado.`,
      `dica: configure com 'git push -u origin ${branchName}'.`
    );
  }
  const [remoteName, ...rest] = up.split("/");
  return { remoteName, remoteBranch: rest.join("/") };
}

function handlePush(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  if (state.head.type === "detached") {
    return fail(state, "não é possível dar push em HEAD destacado neste tutorial (faça checkout de uma branch)");
  }

  const branchName = state.head.name;
  const resolved = resolveRemoteAndBranch(tokens, state, branchName);
  if ("ok" in resolved) return resolved;
  const { remoteName, remoteBranch } = resolved;

  if (!(remoteName in state.remotes)) {
    return fail(state, `fatal: '${remoteName}' não parece ser um repositório git`);
  }

  const localTip = state.branches[branchName];
  if (!localTip) {
    return fail(state, "fatal: não há commits para enviar");
  }

  const ref = remoteRef(remoteName, remoteBranch);
  const remoteTip = state.remoteBranches[ref] ?? null;

  if (remoteTip && remoteTip !== localTip && !isAncestor(state, remoteTip, localTip)) {
    return fail(
      state,
      `! [rejeitado]        ${branchName} -> ${remoteBranch} (dê fetch primeiro)`,
      `error: falha ao enviar algumas referências para '${remoteName}'`,
      "dica: o remoto tem commits que você não tem localmente. Rode 'git fetch' e depois 'git merge' (ou use 'git pull')."
    );
  }

  state.remoteBranches[ref] = localTip;
  state.trackingBranches[ref] = localTip;

  const setUpstream = tokens.includes("-u") || tokens.includes("--set-upstream");
  const lines = [`Para ${remoteName}`, `   ${branchName} -> ${remoteBranch}`];
  if (setUpstream) {
    state.upstream[branchName] = ref;
    lines.push(`branch '${branchName}' configurada para rastrear '${ref}'.`);
  }

  return ok(state, lines, setUpstream ? "git push -u" : "git push");
}

function handleFetch(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  const remoteName = tokens[2] && !tokens[2].startsWith("-") ? tokens[2] : "origin";
  if (!(remoteName in state.remotes)) {
    return fail(state, `fatal: '${remoteName}' não parece ser um repositório git`);
  }

  const prefix = `${remoteName}/`;
  const updated: string[] = [];
  Object.entries(state.remoteBranches).forEach(([ref, commit]) => {
    if (!ref.startsWith(prefix)) return;
    if (state.trackingBranches[ref] !== commit) {
      state.trackingBranches[ref] = commit;
      updated.push(ref);
    }
  });

  if (updated.length === 0) {
    return ok(state, ["Já está tudo atualizado."], "git fetch");
  }
  return ok(state, [`De ${remoteName}`, ...updated.map((ref) => `   ..  ${ref}`)], "git fetch");
}

function handlePull(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  if (state.head.type === "detached") {
    return fail(state, "não é possível dar pull em HEAD destacado neste tutorial (faça checkout de uma branch)");
  }

  const branchName = state.head.name;
  const resolved = resolveRemoteAndBranch(tokens, state, branchName);
  if ("ok" in resolved) return resolved;
  const { remoteName, remoteBranch } = resolved;

  if (!(remoteName in state.remotes)) {
    return fail(state, `fatal: '${remoteName}' não parece ser um repositório git`);
  }

  const fetchResult = handleFetch(["git", "fetch", remoteName], state);
  if (!fetchResult.ok) return fetchResult;

  const ref = remoteRef(remoteName, remoteBranch);
  const targetTip = state.trackingBranches[ref] ?? null;
  return mergeInto(state, branchName, targetTip, tokens, ref, "git pull");
}

function handleClone(tokens: string[], state: RepoState): CommandResult {
  if (state.initialized) {
    return fail(state, "fatal: o diretório atual já é um repositório git");
  }

  const url = tokens[2];
  if (!url) return fail(state, "especifique a url do repositório (ex: git clone <url>)");

  const remoteName = "origin";
  const prefix = `${remoteName}/`;
  const refs = Object.entries(state.remoteBranches).filter(([ref]) => ref.startsWith(prefix));
  if (refs.length === 0) {
    return fail(state, "fatal: repositório não encontrado");
  }

  state.initialized = true;
  state.remotes[remoteName] = url;

  refs.forEach(([ref, commit]) => {
    const branchName = ref.slice(prefix.length);
    state.branches[branchName] = commit;
    state.trackingBranches[ref] = commit;
    state.upstream[branchName] = ref;
  });

  const headBranch = "main" in state.branches ? "main" : refs[0][0].slice(prefix.length);
  state.head = { type: "branch", name: headBranch };

  return ok(state, [`Clonando em '${url}'...`, "concluído."], "git clone");
}
