import { describe, it, expect } from "vitest";
import { runCommand } from "./commands";
import { createInitialState } from "./types";
import type { RepoState } from "./types";

function init(): RepoState {
  return runCommand("git init", createInitialState()).state;
}

function commit(state: RepoState, message = "commit"): RepoState {
  let s = runCommand("git add .", { ...state, workingChanges: ["f.txt"] }).state;
  s = runCommand(`git commit -m "${message}"`, s).state;
  return s;
}

describe("git init", () => {
  it("inicializa um repositório vazio", () => {
    const result = runCommand("git init", createInitialState());
    expect(result.ok).toBe(true);
    expect(result.state.initialized).toBe(true);
    expect(result.state.branches["main"]).toBeNull();
    expect(result.unlockedCommand).toBe("git init");
  });

  it("reinicializar não quebra nada", () => {
    const s = init();
    const result = runCommand("git init", s);
    expect(result.ok).toBe(true);
  });
});

describe("comandos exigem repositório inicializado", () => {
  it.each(["git status", "git add .", "git commit -m x", "git log", "git branch", "git tag v1"])(
    "%s falha sem git init",
    (cmd) => {
      const result = runCommand(cmd, createInitialState());
      expect(result.ok).toBe(false);
    }
  );
});

describe("git add", () => {
  it("adiciona um arquivo específico", () => {
    const s = { ...init(), workingChanges: ["a.txt", "b.txt"] };
    const result = runCommand("git add a.txt", s);
    expect(result.ok).toBe(true);
    expect(result.state.staged).toEqual(["a.txt"]);
    expect(result.state.workingChanges).toEqual(["b.txt"]);
  });

  it("git add . adiciona tudo", () => {
    const s = { ...init(), workingChanges: ["a.txt", "b.txt"] };
    const result = runCommand("git add .", s);
    expect(result.state.staged.sort()).toEqual(["a.txt", "b.txt"]);
    expect(result.state.workingChanges).toEqual([]);
  });

  it("falha sem argumento", () => {
    const s = { ...init(), workingChanges: ["a.txt"] };
    expect(runCommand("git add", s).ok).toBe(false);
  });

  it("falha quando não há alterações pendentes", () => {
    const s = init();
    expect(runCommand("git add .", s).ok).toBe(false);
  });

  it("falha com pathspec desconhecido", () => {
    const s = { ...init(), workingChanges: ["a.txt"] };
    expect(runCommand("git add nao-existe.txt", s).ok).toBe(false);
  });
});

describe("git commit", () => {
  it("cria o primeiro commit", () => {
    const s = { ...init(), staged: ["a.txt"] };
    const result = runCommand('git commit -m "primeiro"', s);
    expect(result.ok).toBe(true);
    expect(Object.keys(result.state.commits)).toEqual(["c1"]);
    expect(result.state.branches["main"]).toBe("c1");
    expect(result.state.staged).toEqual([]);
  });

  it("encadeia commits com parentIds correto", () => {
    let s = commit(init(), "primeiro");
    s = commit(s, "segundo");
    expect(s.commits["c2"].parentIds).toEqual(["c1"]);
  });

  it("falha sem -m", () => {
    const s = { ...init(), staged: ["a.txt"] };
    expect(runCommand("git commit", s).ok).toBe(false);
  });

  it("falha com mensagem vazia", () => {
    const s = { ...init(), staged: ["a.txt"] };
    expect(runCommand('git commit -m ""', s).ok).toBe(false);
  });

  it("falha sem nada staged", () => {
    const s = init();
    expect(runCommand('git commit -m "x"', s).ok).toBe(false);
  });

  it("falha em HEAD destacado", () => {
    let s = commit(init());
    s = runCommand("git checkout c1", s).state;
    const result = runCommand('git commit -m "x"', { ...s, staged: ["a.txt"] });
    expect(result.ok).toBe(false);
  });
});

describe("git log", () => {
  it("lista os commits do mais novo ao mais antigo", () => {
    let s = commit(init(), "primeiro");
    s = commit(s, "segundo");
    const result = runCommand("git log", s);
    expect(result.ok).toBe(true);
    expect(result.output.join("\n")).toContain("segundo");
    expect(result.output.join("\n")).toContain("primeiro");
    expect(result.unlockedCommand).toBe("git log");
  });

  it("falha (não desbloqueia) quando não há commits", () => {
    const result = runCommand("git log", init());
    expect(result.ok).toBe(false);
    expect(result.unlockedCommand).toBeUndefined();
  });
});

describe("git branch", () => {
  it("cria uma branch nova apontando pro commit atual", () => {
    const s = commit(init());
    const result = runCommand("git branch feature", s);
    expect(result.ok).toBe(true);
    expect(result.state.branches["feature"]).toBe("c1");
  });

  it("falha ao criar branch duplicada", () => {
    const s = commit(init());
    const withFeature = runCommand("git branch feature", s).state;
    expect(runCommand("git branch feature", withFeature).ok).toBe(false);
  });

  it("lista as branches marcando a atual", () => {
    const s = commit(init());
    const withFeature = runCommand("git branch feature", s).state;
    const result = runCommand("git branch", withFeature);
    expect(result.output).toContain("* main");
    expect(result.output).toContain("  feature");
  });

  it("-d apaga branch já mesclada", () => {
    const s = commit(init());
    const withFeature = runCommand("git branch feature", s).state;
    const result = runCommand("git branch -d feature", withFeature);
    expect(result.ok).toBe(true);
    expect("feature" in result.state.branches).toBe(false);
  });

  it("-d recusa apagar branch não mesclada", () => {
    let s = commit(init());
    s = runCommand("git checkout -b feature", s).state;
    s = commit(s, "trabalho na feature");
    s = runCommand("git checkout main", s).state;
    const result = runCommand("git branch -d feature", s);
    expect(result.ok).toBe(false);
    expect("feature" in result.state.branches).toBe(true);
  });

  it("-D força a deleção mesmo sem merge", () => {
    let s = commit(init());
    s = runCommand("git checkout -b feature", s).state;
    s = commit(s, "trabalho na feature");
    s = runCommand("git checkout main", s).state;
    const result = runCommand("git branch -D feature", s);
    expect(result.ok).toBe(true);
    expect("feature" in result.state.branches).toBe(false);
  });

  it("falha ao apagar a branch atual", () => {
    const s = commit(init());
    expect(runCommand("git branch -d main", s).ok).toBe(false);
  });
});

describe("git checkout / git switch", () => {
  it("checkout troca para uma branch existente", () => {
    let s = commit(init());
    s = runCommand("git branch feature", s).state;
    const result = runCommand("git checkout feature", s);
    expect(result.ok).toBe(true);
    expect(result.state.head).toEqual({ type: "branch", name: "feature" });
  });

  it("checkout -b cria e troca em um passo", () => {
    const s = commit(init());
    const result = runCommand("git checkout -b feature", s);
    expect(result.ok).toBe(true);
    expect("feature" in result.state.branches).toBe(true);
    expect(result.state.head).toEqual({ type: "branch", name: "feature" });
  });

  it("checkout com id de commit produz HEAD destacado", () => {
    const s = commit(init());
    const result = runCommand("git checkout c1", s);
    expect(result.ok).toBe(true);
    expect(result.state.head).toEqual({ type: "detached", commit: "c1" });
  });

  it("checkout falha com pathspec desconhecido", () => {
    const s = commit(init());
    expect(runCommand("git checkout nao-existe", s).ok).toBe(false);
  });

  it("switch -c cria e troca em um passo", () => {
    const s = commit(init());
    const result = runCommand("git switch -c feature", s);
    expect(result.ok).toBe(true);
    expect(result.state.head).toEqual({ type: "branch", name: "feature" });
  });

  it("switch falha com referência inválida", () => {
    const s = commit(init());
    expect(runCommand("git switch nao-existe", s).ok).toBe(false);
  });
});

describe("git merge", () => {
  function divergedSetup() {
    let s = commit(init(), "c1");
    s = runCommand("git branch feature", s).state;
    s = commit(s, "c2 na main");
    s = runCommand("git checkout feature", s).state;
    s = commit(s, "c3 na feature");
    s = runCommand("git checkout main", s).state;
    return s;
  }

  it("already up to date quando a branch já está incorporada", () => {
    const s = commit(init());
    const withFeature = runCommand("git branch feature", s).state;
    const result = runCommand("git merge feature", withFeature);
    expect(result.ok).toBe(true);
    expect(result.output.join("\n")).toContain("Já está tudo atualizado");
  });

  it("fast-forward quando main não avançou", () => {
    let s = commit(init());
    s = runCommand("git checkout -b feature", s).state;
    s = commit(s, "trabalho");
    s = runCommand("git checkout main", s).state;
    const result = runCommand("git merge feature", s);
    expect(result.ok).toBe(true);
    expect(result.output.join("\n")).toContain("Avanço rápido");
    expect(result.state.branches["main"]).toBe(result.state.branches["feature"]);
  });

  it("cria commit de merge quando históricos divergiram", () => {
    const s = divergedSetup();
    const result = runCommand("git merge feature", s);
    expect(result.ok).toBe(true);
    const tip = result.state.branches["main"]!;
    expect(result.state.commits[tip].parentIds).toHaveLength(2);
  });

  it("falha sem especificar a branch", () => {
    const s = commit(init());
    expect(runCommand("git merge", s).ok).toBe(false);
  });

  it("falha com branch inexistente", () => {
    const s = commit(init());
    expect(runCommand("git merge nao-existe", s).ok).toBe(false);
  });

  it("falha ao dar merge da branch nela mesma", () => {
    const s = commit(init());
    expect(runCommand("git merge main", s).ok).toBe(false);
  });

  it("falha em HEAD destacado", () => {
    let s = commit(init());
    s = runCommand("git branch feature", s).state;
    s = runCommand("git checkout c1", s).state;
    expect(runCommand("git merge feature", s).ok).toBe(false);
  });
});

describe("git tag", () => {
  it("cria uma tag leve", () => {
    const s = commit(init());
    const result = runCommand("git tag v1.0.0", s);
    expect(result.ok).toBe(true);
    expect(result.state.tags["v1.0.0"]).toEqual({ commit: "c1", annotated: false });
  });

  it("cria uma tag anotada com mensagem", () => {
    const s = commit(init());
    const result = runCommand('git tag -a v1.0.0 -m "release"', s);
    expect(result.ok).toBe(true);
    expect(result.state.tags["v1.0.0"]).toEqual({
      commit: "c1",
      message: "release",
      annotated: true,
    });
  });

  it("falha ao criar tag duplicada", () => {
    const s = runCommand("git tag v1.0.0", commit(init())).state;
    expect(runCommand("git tag v1.0.0", s).ok).toBe(false);
  });

  it("falha sem nenhum commit", () => {
    expect(runCommand("git tag v1.0.0", init()).ok).toBe(false);
  });

  it("lista as tags existentes", () => {
    const s = runCommand("git tag v1.0.0", commit(init())).state;
    const result = runCommand("git tag", s);
    expect(result.output).toEqual(["v1.0.0"]);
  });
});

describe("comando não suportado / entrada vazia", () => {
  it("comando fora do git falha", () => {
    expect(runCommand("ls -la", createInitialState()).ok).toBe(false);
  });

  it("subcomando git desconhecido falha", () => {
    expect(runCommand("git rebase main", init()).ok).toBe(false);
  });

  it("entrada vazia falha sem quebrar", () => {
    expect(runCommand("   ", createInitialState()).ok).toBe(false);
  });
});

describe("git restore", () => {
  it("descarta uma alteração na área de trabalho", () => {
    const s = { ...init(), workingChanges: ["a.txt"] };
    const result = runCommand("git restore a.txt", s);
    expect(result.ok).toBe(true);
    expect(result.state.workingChanges).toEqual([]);
  });

  it("--staged desfaz o add sem perder a alteração", () => {
    const s = { ...init(), staged: ["a.txt"] };
    const result = runCommand("git restore --staged a.txt", s);
    expect(result.ok).toBe(true);
    expect(result.state.staged).toEqual([]);
    expect(result.state.workingChanges).toEqual(["a.txt"]);
  });

  it("falha com arquivo que não está no lugar esperado", () => {
    const s = init();
    expect(runCommand("git restore a.txt", s).ok).toBe(false);
    expect(runCommand("git restore --staged a.txt", s).ok).toBe(false);
  });

  it("falha sem argumento", () => {
    expect(runCommand("git restore", init()).ok).toBe(false);
  });
});

describe("git reset", () => {
  function setupWithStaged() {
    let s = commit(init(), "primeiro");
    s = commit(s, "segundo");
    return { ...s, staged: ["extra.txt"] };
  }

  it("--soft move a branch mas preserva staged", () => {
    const s = setupWithStaged();
    const result = runCommand("git reset --soft HEAD~1", s);
    expect(result.ok).toBe(true);
    expect(result.state.branches["main"]).toBe("c1");
    expect(result.state.staged).toEqual(["extra.txt"]);
    expect(result.unlockedCommand).toBe("git reset --soft");
  });

  it("--mixed (padrão) move a branch e tira tudo do staging", () => {
    const s = setupWithStaged();
    const result = runCommand("git reset HEAD~1", s);
    expect(result.ok).toBe(true);
    expect(result.state.branches["main"]).toBe("c1");
    expect(result.state.staged).toEqual([]);
    expect(result.state.workingChanges).toEqual(["extra.txt"]);
    expect(result.unlockedCommand).toBe("git reset --mixed");
  });

  it("--hard move a branch e descarta staged e working changes", () => {
    const s = { ...setupWithStaged(), workingChanges: ["outro.txt"] };
    const result = runCommand("git reset --hard HEAD~1", s);
    expect(result.ok).toBe(true);
    expect(result.state.branches["main"]).toBe("c1");
    expect(result.state.staged).toEqual([]);
    expect(result.state.workingChanges).toEqual([]);
  });

  it("aceita um id de commit direto como alvo", () => {
    const s = setupWithStaged();
    const result = runCommand("git reset --hard c1", s);
    expect(result.ok).toBe(true);
    expect(result.state.branches["main"]).toBe("c1");
  });

  it("falha com revisão desconhecida", () => {
    const s = commit(init());
    expect(runCommand("git reset --hard nao-existe", s).ok).toBe(false);
  });

  it("falha em HEAD destacado", () => {
    let s = commit(init());
    s = runCommand("git checkout c1", s).state;
    expect(runCommand("git reset --hard HEAD~1", s).ok).toBe(false);
  });
});

describe("git revert", () => {
  it("cria um commit novo que desfaz o efeito do commit indicado", () => {
    let s = commit(init(), "primeiro");
    s = commit(s, "segundo");
    const result = runCommand("git revert c2", s);
    expect(result.ok).toBe(true);
    const tip = result.state.branches["main"]!;
    expect(result.state.commits[tip].message).toBe('Revert "segundo"');
    expect(result.state.commits[tip].parentIds).toEqual(["c2"]);
  });

  it("não reescreve nenhum commit existente", () => {
    let s = commit(init(), "primeiro");
    s = commit(s, "segundo");
    const before = Object.keys(s.commits).length;
    const result = runCommand("git revert c2", s);
    expect(Object.keys(result.state.commits).length).toBe(before + 1);
    expect(result.state.commits["c1"].message).toBe("primeiro");
    expect(result.state.commits["c2"].message).toBe("segundo");
  });

  it("falha com commit inexistente", () => {
    const s = commit(init());
    expect(runCommand("git revert c9", s).ok).toBe(false);
  });

  it("falha sem argumento", () => {
    const s = commit(init());
    expect(runCommand("git revert", s).ok).toBe(false);
  });

  it("falha em HEAD destacado", () => {
    let s = commit(init());
    s = runCommand("git checkout c1", s).state;
    expect(runCommand("git revert c1", s).ok).toBe(false);
  });
});

describe("git remote", () => {
  it("registra um remoto novo", () => {
    const s = init();
    const result = runCommand("git remote add origin https://example.com/repo.git", s);
    expect(result.ok).toBe(true);
    expect(result.state.remotes["origin"]).toBe("https://example.com/repo.git");
    expect(result.unlockedCommand).toBe("git remote add");
  });

  it("falha ao registrar remoto duplicado", () => {
    const s = runCommand("git remote add origin url", init()).state;
    expect(runCommand("git remote add origin outra-url", s).ok).toBe(false);
  });

  it("falha sem nome ou url", () => {
    expect(runCommand("git remote add origin", init()).ok).toBe(false);
    expect(runCommand("git remote add", init()).ok).toBe(false);
  });

  it("-v lista os remotos registrados", () => {
    const s = runCommand("git remote add origin url", init()).state;
    const result = runCommand("git remote -v", s);
    expect(result.ok).toBe(true);
    expect(result.output.join("\n")).toContain("origin");
  });
});

describe("git push", () => {
  function withOrigin() {
    let s = commit(init(), "primeiro");
    s = runCommand("git remote add origin url", s).state;
    return s;
  }

  it("-u envia e configura o upstream", () => {
    const s = withOrigin();
    const result = runCommand("git push -u origin main", s);
    expect(result.ok).toBe(true);
    expect(result.state.remoteBranches["origin/main"]).toBe("c1");
    expect(result.state.trackingBranches["origin/main"]).toBe("c1");
    expect(result.state.upstream["main"]).toBe("origin/main");
    expect(result.unlockedCommand).toBe("git push -u");
  });

  it("push simples sem -u não configura upstream", () => {
    const s = withOrigin();
    const result = runCommand("git push origin main", s);
    expect(result.ok).toBe(true);
    expect(result.state.upstream["main"]).toBeUndefined();
    expect(result.unlockedCommand).toBe("git push");
  });

  it("usa o upstream configurado quando chamado sem argumentos", () => {
    let s = withOrigin();
    s = runCommand("git push -u origin main", s).state;
    s = commit(s, "segundo");
    const result = runCommand("git push", s);
    expect(result.ok).toBe(true);
    expect(result.state.remoteBranches["origin/main"]).toBe("c2");
  });

  it("falha sem upstream e sem argumentos", () => {
    const s = withOrigin();
    expect(runCommand("git push", s).ok).toBe(false);
  });

  it("falha com remoto não registrado", () => {
    const s = commit(init());
    expect(runCommand("git push origin main", s).ok).toBe(false);
  });

  it("é rejeitado quando o remoto tem commits que o local não tem", () => {
    let s = withOrigin();
    s = runCommand("git push -u origin main", s).state;
    // alguém mais empurrou um commit direto pro remoto
    s = {
      ...s,
      commitCounter: 2,
      commits: {
        ...s.commits,
        c2: { id: "c2", parentIds: ["c1"], message: "colega", createdOnBranch: "main" },
      },
      remoteBranches: { "origin/main": "c2" },
    };
    const result = runCommand("git push", s);
    expect(result.ok).toBe(false);
  });
});

describe("git fetch", () => {
  it("atualiza a referência de rastreamento sem mexer na branch local", () => {
    let s = commit(init(), "primeiro");
    s = runCommand("git remote add origin url", s).state;
    s = runCommand("git push -u origin main", s).state;
    s = {
      ...s,
      commitCounter: 2,
      commits: {
        ...s.commits,
        c2: { id: "c2", parentIds: ["c1"], message: "colega", createdOnBranch: "main" },
      },
      remoteBranches: { "origin/main": "c2" },
    };
    const result = runCommand("git fetch", s);
    expect(result.ok).toBe(true);
    expect(result.state.trackingBranches["origin/main"]).toBe("c2");
    expect(result.state.branches["main"]).toBe("c1");
  });

  it("already up to date quando não há nada novo", () => {
    let s = commit(init());
    s = runCommand("git remote add origin url", s).state;
    s = runCommand("git push -u origin main", s).state;
    const result = runCommand("git fetch", s);
    expect(result.output.join("\n")).toContain("Já está tudo atualizado");
  });

  it("falha com remoto não registrado", () => {
    expect(runCommand("git fetch", commit(init())).ok).toBe(false);
  });
});

describe("git pull", () => {
  function withRemoteAhead(): RepoState {
    let s = commit(init(), "primeiro");
    s = runCommand("git remote add origin url", s).state;
    s = runCommand("git push -u origin main", s).state;
    return {
      ...s,
      commitCounter: 2,
      commits: {
        ...s.commits,
        c2: { id: "c2", parentIds: ["c1"], message: "colega", createdOnBranch: "main" },
      },
      remoteBranches: { "origin/main": "c2" },
    };
  }

  it("faz fetch + fast-forward quando não há divergência", () => {
    const s = withRemoteAhead();
    const result = runCommand("git pull", s);
    expect(result.ok).toBe(true);
    expect(result.state.branches["main"]).toBe("c2");
    expect(result.state.trackingBranches["origin/main"]).toBe("c2");
    expect(result.unlockedCommand).toBe("git pull");
  });

  it("cria commit de merge quando histórico local também avançou", () => {
    let s = withRemoteAhead();
    s = commit(s, "trabalho local");
    const result = runCommand("git pull", s);
    expect(result.ok).toBe(true);
    const tip = result.state.branches["main"]!;
    expect(result.state.commits[tip].parentIds).toHaveLength(2);
  });

  it("falha sem upstream e sem argumentos", () => {
    const s = commit(init());
    expect(runCommand("git pull", s).ok).toBe(false);
  });
});

describe("git clone", () => {
  function remoteOnlyRepo(): RepoState {
    const s = createInitialState();
    s.commitCounter = 1;
    s.commits["c1"] = { id: "c1", parentIds: [], message: "primeiro commit", createdOnBranch: "main" };
    s.remoteBranches["origin/main"] = "c1";
    return s;
  }

  it("inicializa o repositório a partir do remoto", () => {
    const s = remoteOnlyRepo();
    const result = runCommand("git clone https://example.com/repo.git", s);
    expect(result.ok).toBe(true);
    expect(result.state.initialized).toBe(true);
    expect(result.state.branches["main"]).toBe("c1");
    expect(result.state.trackingBranches["origin/main"]).toBe("c1");
    expect(result.state.upstream["main"]).toBe("origin/main");
    expect(result.state.remotes["origin"]).toBe("https://example.com/repo.git");
  });

  it("falha se já houver um repositório inicializado", () => {
    expect(runCommand("git clone url", init()).ok).toBe(false);
  });

  it("falha sem url", () => {
    expect(runCommand("git clone", remoteOnlyRepo()).ok).toBe(false);
  });

  it("falha se não houver nada para clonar", () => {
    expect(runCommand("git clone url", createInitialState()).ok).toBe(false);
  });
});

describe("git submodule", () => {
  it("add registra o submódulo já inicializado", () => {
    const result = runCommand(
      "git submodule add https://github.com/exemplo/ui-kit.git libs/ui-kit",
      init()
    );
    expect(result.ok).toBe(true);
    expect(result.state.submodules["libs/ui-kit"]).toEqual({
      url: "https://github.com/exemplo/ui-kit.git",
      commit: "sub1",
      initialized: true,
    });
  });

  it("add falha sem url ou path", () => {
    expect(runCommand("git submodule add", init()).ok).toBe(false);
    expect(runCommand("git submodule add https://x.git", init()).ok).toBe(false);
  });

  it("add falha se o caminho já existe", () => {
    const s = runCommand("git submodule add https://x.git libs/x", init()).state;
    expect(runCommand("git submodule add https://y.git libs/x", s).ok).toBe(false);
  });

  it("init falha sem nenhum submódulo declarado", () => {
    expect(runCommand("git submodule init", init()).ok).toBe(false);
  });

  it("init marca o submódulo como inicializado, sem trazer conteúdo", () => {
    let s = init();
    s = { ...s, submodules: { "libs/x": { url: "https://x.git", commit: null, initialized: false } } };
    const result = runCommand("git submodule init", s);
    expect(result.ok).toBe(true);
    expect(result.state.submodules["libs/x"].initialized).toBe(true);
    expect(result.state.submodules["libs/x"].commit).toBeNull();
  });

  it("update falha sem nenhum submódulo inicializado", () => {
    let s = init();
    s = { ...s, submodules: { "libs/x": { url: "https://x.git", commit: null, initialized: false } } };
    expect(runCommand("git submodule update", s).ok).toBe(false);
  });

  it("update traz o conteúdo de um submódulo já inicializado", () => {
    let s = init();
    s = { ...s, submodules: { "libs/x": { url: "https://x.git", commit: null, initialized: true } } };
    const result = runCommand("git submodule update", s);
    expect(result.ok).toBe(true);
    expect(result.state.submodules["libs/x"].commit).not.toBeNull();
  });

  it("status não muda nenhum submódulo, só marca lastSubmoduleAction", () => {
    let s = init();
    s = {
      ...s,
      submodules: { "libs/x": { url: "https://x.git", commit: "sub1", initialized: true } },
    };
    const result = runCommand("git submodule status", s);
    expect(result.ok).toBe(true);
    expect(result.state.submodules).toEqual(s.submodules);
    expect(result.state.lastSubmoduleAction).toBe("status");
  });
});

describe("git stash", () => {
  it("push guarda staged e workingChanges e limpa os dois", () => {
    const s = { ...init(), staged: ["a.txt"], workingChanges: ["b.txt"] };
    const result = runCommand("git stash", s);
    expect(result.ok).toBe(true);
    expect(result.state.stash).toHaveLength(1);
    expect(result.state.stash[0]).toMatchObject({ staged: ["a.txt"], workingChanges: ["b.txt"] });
    expect(result.state.staged).toEqual([]);
    expect(result.state.workingChanges).toEqual([]);
    expect(result.unlockedCommand).toBe("git stash");
  });

  it("falha sem nenhuma alteração", () => {
    expect(runCommand("git stash", init()).ok).toBe(false);
  });

  it("pop falha com a pilha vazia", () => {
    expect(runCommand("git stash pop", init()).ok).toBe(false);
  });

  it("pop restaura e remove do topo da pilha", () => {
    const s = {
      ...init(),
      stash: [{ message: "WIP", staged: ["a.txt"], workingChanges: ["b.txt"] }],
    };
    const result = runCommand("git stash pop", s);
    expect(result.ok).toBe(true);
    expect(result.state.stash).toEqual([]);
    expect(result.state.staged).toEqual(["a.txt"]);
    expect(result.state.workingChanges).toEqual(["b.txt"]);
  });

  it("list não muda a pilha e marca lastCommandDetail", () => {
    const s = { ...init(), stash: [{ message: "WIP", staged: [], workingChanges: ["b.txt"] }] };
    const result = runCommand("git stash list", s);
    expect(result.ok).toBe(true);
    expect(result.state.stash).toEqual(s.stash);
    expect(result.state.lastCommand).toBe("stash");
    expect(result.state.lastCommandDetail).toBe("list");
  });
});

describe("git diff", () => {
  it("sem --staged marca lastCommandDetail unstaged", () => {
    const s = { ...init(), workingChanges: ["a.txt"] };
    const result = runCommand("git diff", s);
    expect(result.ok).toBe(true);
    expect(result.state.lastCommandDetail).toBe("unstaged");
  });

  it("com --staged marca lastCommandDetail staged", () => {
    const s = { ...init(), staged: ["a.txt"] };
    const result = runCommand("git diff --staged", s);
    expect(result.ok).toBe(true);
    expect(result.state.lastCommandDetail).toBe("staged");
  });
});

describe("git show", () => {
  it("falha para um commit inexistente", () => {
    expect(runCommand("git show cX", init()).ok).toBe(false);
  });

  it("marca lastCommandDetail com o id do commit", () => {
    const s = commit(init());
    const result = runCommand("git show c1", s);
    expect(result.ok).toBe(true);
    expect(result.state.lastCommand).toBe("show");
    expect(result.state.lastCommandDetail).toBe("c1");
  });
});

describe("git rm", () => {
  it("falha para um arquivo não rastreado", () => {
    expect(runCommand("git rm x.txt", init()).ok).toBe(false);
  });

  it("remove de trackedFiles e prepara a remoção", () => {
    const s = { ...init(), trackedFiles: ["x.txt"] };
    const result = runCommand("git rm x.txt", s);
    expect(result.ok).toBe(true);
    expect(result.state.trackedFiles).not.toContain("x.txt");
    expect(result.state.staged).toContain("x.txt");
  });
});

describe("git mv", () => {
  it("falha para um arquivo não rastreado", () => {
    expect(runCommand("git mv x.txt y.txt", init()).ok).toBe(false);
  });

  it("renomeia em trackedFiles e prepara o destino", () => {
    const s = { ...init(), trackedFiles: ["x.txt"] };
    const result = runCommand("git mv x.txt y.txt", s);
    expect(result.ok).toBe(true);
    expect(result.state.trackedFiles).toEqual(["y.txt"]);
    expect(result.state.staged).toContain("y.txt");
  });
});

describe("git cherry-pick", () => {
  it("falha para um commit inexistente", () => {
    expect(runCommand("git cherry-pick cX", init()).ok).toBe(false);
  });

  it("cria um novo commit com o mesmo conteúdo do original", () => {
    let s = init();
    s.branches["feature"] = null;
    s = { ...s, head: { type: "branch", name: "feature" } };
    s = commit(s, "trabalho da feature");
    s = { ...s, head: { type: "branch", name: "main" } };
    const featureTip = s.branches["feature"]!;

    const result = runCommand(`git cherry-pick ${featureTip}`, s);
    expect(result.ok).toBe(true);
    const newTip = result.state.branches["main"]!;
    expect(newTip).not.toBe(featureTip);
    expect(result.state.commits[newTip].message).toBe("trabalho da feature");
  });
});

describe("git blame", () => {
  it("falha sem argumento", () => {
    expect(runCommand("git blame", init()).ok).toBe(false);
  });

  it("marca lastCommandDetail com o arquivo", () => {
    const result = runCommand("git blame index.js", init());
    expect(result.ok).toBe(true);
    expect(result.state.lastCommand).toBe("blame");
    expect(result.state.lastCommandDetail).toBe("index.js");
  });
});

describe("git clean", () => {
  it("falha sem -f", () => {
    const s = { ...init(), untrackedFiles: ["debug.log"] };
    expect(runCommand("git clean", s).ok).toBe(false);
  });

  it("-fd remove os arquivos não rastreados", () => {
    const s = { ...init(), untrackedFiles: ["debug.log"] };
    const result = runCommand("git clean -fd", s);
    expect(result.ok).toBe(true);
    expect(result.state.untrackedFiles).toEqual([]);
  });
});

describe("imutabilidade", () => {
  it("runCommand não muta o estado recebido", () => {
    const before = init();
    const snapshot = JSON.parse(JSON.stringify(before));
    runCommand("git branch feature", commit(before));
    expect(before).toEqual(snapshot);
  });

  it("git add não muta o array workingChanges original", () => {
    const s = init();
    const withChanges = { ...s, workingChanges: ["a.txt"] };
    const originalArray = withChanges.workingChanges;
    runCommand("git add a.txt", withChanges);
    expect(originalArray).toEqual(["a.txt"]);
  });
});
