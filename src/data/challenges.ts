import type { RepoState } from "../engine/types";
import { createInitialState } from "../engine/types";

export interface Challenge {
  id: string;
  trilha: string;
  title: string;
  description: string;
  hint: string;
  setup: () => RepoState;
  goal: (state: RepoState) => boolean;
}

const TRILHAS_ORDER = ["Fundamentos", "Branching", "Tags"] as const;
export { TRILHAS_ORDER };

function baseInitialized(): RepoState {
  const s = createInitialState();
  s.initialized = true;
  s.branches["main"] = null;
  s.head = { type: "branch", name: "main" };
  return s;
}

function withOneChange(fileName = "index.js"): RepoState {
  const s = baseInitialized();
  s.workingChanges.push(fileName);
  return s;
}

function withOneCommit(): RepoState {
  const s = baseInitialized();
  s.commitCounter = 1;
  s.commits["c1"] = {
    id: "c1",
    parentIds: [],
    message: "primeiro commit",
    createdOnBranch: "main",
  };
  s.branches["main"] = "c1";
  return s;
}

function withTwoCommits(): RepoState {
  const s = withOneCommit();
  s.commitCounter = 2;
  s.commits["c2"] = {
    id: "c2",
    parentIds: ["c1"],
    message: "segundo commit",
    createdOnBranch: "main",
  };
  s.branches["main"] = "c2";
  return s;
}

/** main parada em c1; feature-login um commit à frente → merge é fast-forward. */
function withBranchAhead(): RepoState {
  const s = withOneCommit();
  s.commitCounter = 2;
  s.commits["c2"] = {
    id: "c2",
    parentIds: ["c1"],
    message: "tela de login",
    createdOnBranch: "feature-login",
  };
  s.branches["feature-login"] = "c2";
  return s;
}

/** main e feature-login avançaram cada uma por seu lado → merge precisa de commit de merge. */
function withDivergedBranches(): RepoState {
  const s = withOneCommit();
  s.commitCounter = 3;
  s.commits["c2"] = {
    id: "c2",
    parentIds: ["c1"],
    message: "ajusta o header",
    createdOnBranch: "main",
  };
  s.commits["c3"] = {
    id: "c3",
    parentIds: ["c1"],
    message: "tela de login",
    createdOnBranch: "feature-login",
  };
  s.branches["main"] = "c2";
  s.branches["feature-login"] = "c3";
  return s;
}

export const CHALLENGES: Challenge[] = [
  {
    id: "init-1",
    trilha: "Fundamentos",
    title: "Comece um repositório",
    description:
      "Você acabou de criar uma pasta para um projeto novo. Inicialize um repositório git nela.",
    hint: "git init",
    setup: () => createInitialState(),
    goal: (s) => s.initialized,
  },
  {
    id: "add-1",
    trilha: "Fundamentos",
    title: "Prepare uma alteração",
    description:
      "Você editou 'index.js'. Antes de gravar no histórico, é preciso preparar (stage) a alteração.",
    hint: "git add index.js  (ou git add .)",
    setup: () => withOneChange("index.js"),
    goal: (s) => s.staged.includes("index.js"),
  },
  {
    id: "commit-1",
    trilha: "Fundamentos",
    title: "Grave seu primeiro commit",
    description:
      "'index.js' já está preparado. Grave essa alteração no histórico com uma mensagem descritiva.",
    hint: 'git commit -m "sua mensagem"',
    setup: () => {
      const s = withOneChange("index.js");
      s.staged.push("index.js");
      s.workingChanges = [];
      return s;
    },
    goal: (s) => Object.keys(s.commits).length >= 1,
  },
  {
    id: "log-1",
    trilha: "Fundamentos",
    title: "Veja o histórico",
    description: "Este repositório já tem commits. Liste o histórico a partir do commit atual.",
    hint: "git log",
    setup: () => withTwoCommits(),
    goal: () => true,
  },
  {
    id: "branch-1",
    trilha: "Branching",
    title: "Crie uma branch",
    description:
      "Você vai começar uma funcionalidade nova sem afetar 'main'. Crie a branch 'feature-login'.",
    hint: "git branch feature-login",
    setup: () => withOneCommit(),
    goal: (s) => "feature-login" in s.branches,
  },
  {
    id: "checkout-1",
    trilha: "Branching",
    title: "Troque de branch",
    description:
      "A branch 'feature-login' já existe. Troque o HEAD para ela.",
    hint: "git checkout feature-login  (ou git switch feature-login)",
    setup: () => {
      const s = withOneCommit();
      s.branches["feature-login"] = s.branches["main"];
      return s;
    },
    goal: (s) => s.head.type === "branch" && s.head.name === "feature-login",
  },
  {
    id: "checkout-b-1",
    trilha: "Branching",
    title: "Crie e troque em um passo",
    description:
      "Crie a branch 'feature-cart' e já troque para ela, em um único comando.",
    hint: "git checkout -b feature-cart",
    setup: () => withOneCommit(),
    goal: (s) =>
      "feature-cart" in s.branches &&
      s.head.type === "branch" &&
      s.head.name === "feature-cart",
  },
  {
    id: "merge-ff-1",
    trilha: "Branching",
    title: "Traga a feature de volta",
    description:
      "'feature-login' tem um commit que 'main' ainda não tem, e 'main' não avançou desde que a branch nasceu. Você está em 'main': incorpore o trabalho da feature.",
    hint: "git merge feature-login  (aqui o git só avança o ponteiro: fast-forward)",
    setup: () => withBranchAhead(),
    goal: (s) => s.branches["main"] === "c2",
  },
  {
    id: "merge-1",
    trilha: "Branching",
    title: "Junte históricos que divergiram",
    description:
      "Desta vez 'main' também avançou enquanto 'feature-login' era desenvolvida. Você está em 'main': junte as duas histórias. Repare no grafo: o git vai precisar criar um commit novo, com dois pais.",
    hint: "git merge feature-login",
    setup: () => withDivergedBranches(),
    goal: (s) => {
      const tip = s.branches["main"];
      return !!tip && s.commits[tip]?.parentIds.length === 2;
    },
  },
  {
    id: "branch-d-1",
    trilha: "Branching",
    title: "Delete uma branch",
    description:
      "A branch 'old-experiment' não é mais necessária e você está em 'main'. Delete-a.",
    hint: "git branch -d old-experiment",
    setup: () => {
      const s = withOneCommit();
      s.branches["old-experiment"] = s.branches["main"];
      return s;
    },
    goal: (s) => !("old-experiment" in s.branches),
  },
  {
    id: "tag-1",
    trilha: "Tags",
    title: "Marque uma versão",
    description:
      "O commit atual é uma versão estável. Crie uma tag leve chamada 'v1.0.0'.",
    hint: "git tag v1.0.0",
    setup: () => withOneCommit(),
    goal: (s) => "v1.0.0" in s.tags,
  },
  {
    id: "tag-a-1",
    trilha: "Tags",
    title: "Marque uma release de verdade",
    description:
      "Para releases oficiais, use uma tag anotada, que guarda mensagem e autor. Crie a tag anotada 'v2.0.0' com uma mensagem.",
    hint: 'git tag -a v2.0.0 -m "sua mensagem"',
    setup: () => withTwoCommits(),
    goal: (s) => s.tags["v2.0.0"]?.annotated === true,
  },
];
