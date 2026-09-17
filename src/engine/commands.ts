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
    default:
      return fail(state, `git: '${sub}' não é um comando suportado neste simulador ainda.`);
  }
}

function requireInit(state: RepoState): CommandResult | null {
  if (!state.initialized) {
    return fail(state, "fatal: not a git repository (rode 'git init' primeiro)");
  }
  return null;
}

function handleInit(state: RepoState): CommandResult {
  if (state.initialized) {
    return ok(state, ["Reinitialized existing Git repository."]);
  }
  state.initialized = true;
  state.branches["main"] = null;
  state.head = { type: "branch", name: "main" };
  return ok(state, ["Initialized empty Git repository in ./.git/"], "git init");
}

function handleStatus(state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  const lines: string[] = [];
  lines.push(
    state.head.type === "branch"
      ? `On branch ${state.head.name}`
      : `HEAD detached at ${state.head.commit.slice(0, 7)}`
  );
  if (state.staged.length === 0 && state.workingChanges.length === 0) {
    lines.push("nothing to commit, working tree clean");
  } else {
    if (state.staged.length > 0) {
      lines.push("Changes to be committed:");
      state.staged.forEach((f) => lines.push(`  new file:   ${f}`));
    }
    if (state.workingChanges.length > 0) {
      lines.push("Changes not staged for commit:");
      state.workingChanges.forEach((f) => lines.push(`  modified:   ${f}`));
    }
  }
  return ok(state, lines, "git status");
}

function handleAdd(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  const arg = tokens[2];
  if (!arg) return fail(state, "Nothing specified, nothing added.");

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
    return fail(state, "Aborting commit due to empty commit message.");
  }
  if (state.staged.length === 0) {
    return fail(state, "nothing added to commit (use 'git add')");
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
    return fail(state, "fatal: your current branch does not have any commits yet");
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
      return fail(state, `error: branch '${name}' not found.`);
    }
    if (state.head.type === "branch" && state.head.name === name) {
      return fail(state, `error: Cannot delete branch '${name}' checked out`);
    }
    const tip = state.branches[name];
    const head = currentCommit(state);
    if (!force && tip && head && !isAncestor(state, tip, head)) {
      return fail(
        state,
        `error: The branch '${name}' is not fully merged.`,
        `If you are sure you want to delete it, run 'git branch -D ${name}'.`
      );
    }
    delete state.branches[name];
    return ok(state, [`Deleted branch ${name}.`], "git branch -d");
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
    return fail(state, `fatal: A branch named '${name}' already exists.`);
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
      return fail(state, `fatal: A branch named '${name}' already exists.`);
    }
    state.branches[name] = currentCommit(state);
    state.head = { type: "branch", name };
    return ok(state, [`Switched to a new branch '${name}'`], "git checkout -b");
  }

  const name = tokens[2];
  if (!name) return fail(state, "especifique uma branch");
  if (name in state.branches) {
    state.head = { type: "branch", name };
    return ok(state, [`Switched to branch '${name}'`], "git checkout");
  }
  if (name in state.commits) {
    state.head = { type: "detached", commit: name };
    return ok(
      state,
      [
        `Note: switching to '${name}'.`,
        "",
        "You are in 'detached HEAD' state. You can look around, make experimental",
        "changes and commit them, and you can discard any commits you make in this",
        "state without impacting any branches by switching back to a branch.",
        "",
        `HEAD is now at ${name.slice(0, 7)}`,
      ],
      "git checkout (detached)"
    );
  }
  return fail(state, `error: pathspec '${name}' did not match any file(s) known to git`);
}

function handleSwitch(tokens: string[], state: RepoState): CommandResult {
  const notInit = requireInit(state);
  if (notInit) return notInit;

  if (tokens[2] === "-c") {
    const name = tokens[3];
    if (!name) return fail(state, "especifique o nome da nova branch");
    if (name in state.branches) {
      return fail(state, `fatal: A branch named '${name}' already exists.`);
    }
    state.branches[name] = currentCommit(state);
    state.head = { type: "branch", name };
    return ok(state, [`Switched to a new branch '${name}'`], "git switch -c");
  }

  const name = tokens[2];
  if (!name) return fail(state, "especifique uma branch");
  if (!(name in state.branches)) {
    return fail(state, `fatal: invalid reference: ${name}`);
  }
  state.head = { type: "branch", name };
  return ok(state, [`Switched to branch '${name}'`], "git switch");
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
    return fail(state, `merge: ${name} - not something we can merge`);
  }

  const into = state.head.name;
  if (name === into) {
    return fail(state, `fatal: não é possível fazer merge de '${name}' nela mesma`);
  }

  const targetTip = state.branches[name];
  if (!targetTip) {
    return ok(state, ["Already up to date."], "git merge");
  }

  const currentTip = currentCommit(state);

  // A outra branch já está inteira no histórico atual: não há o que trazer.
  if (currentTip && isAncestor(state, targetTip, currentTip)) {
    return ok(state, ["Already up to date."], "git merge");
  }

  // Fast-forward: a branch atual não tem nenhum commit que a outra já não tenha,
  // então basta avançar o ponteiro — nenhum commit novo é criado.
  const noFf = tokens.includes("--no-ff");
  if (!currentTip || (!noFf && isAncestor(state, currentTip, targetTip))) {
    state.branches[into] = targetTip;
    return ok(
      state,
      currentTip
        ? [`Updating ${currentTip}..${targetTip}`, "Fast-forward"]
        : [`Updating ${targetTip}`, "Fast-forward"],
      "git merge"
    );
  }

  // Históricos divergiram: nasce um commit de merge, com os dois tips como pais.
  const message = extractMessage(tokens, "-m") ?? `Merge branch '${name}' into ${into}`;
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
    ["Merge made by the 'ort' strategy.", `[${into} ${id}] ${message}`],
    "git merge"
  );
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
    if (name in state.tags) return fail(state, `fatal: tag '${name}' already exists`);
    state.tags[name] = { commit: cur, message, annotated: true };
    return ok(state, [], "git tag -a");
  }

  const name = tokens[2];
  if (!name) {
    return ok(state, Object.keys(state.tags), "git tag");
  }
  if (name in state.tags) return fail(state, `fatal: tag '${name}' already exists`);
  state.tags[name] = { commit: cur, annotated: false };
  return ok(state, [], "git tag");
}
