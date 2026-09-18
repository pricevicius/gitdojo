import type { RepoState } from "../engine/types";
import { createInitialState } from "../engine/types";
import type { DojoChallenge } from "../dojo/types";

export type Challenge = DojoChallenge<RepoState>;

const TRILHAS_ORDER = ["Fundamentos", "Branching", "Tags", "Desfazer", "Remoto"] as const;
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

/** Dois commits, mais um arquivo staged que não veio de nenhum dos dois. */
function withTwoCommitsAndStaged(fileName = "extra.txt"): RepoState {
  const s = withTwoCommits();
  s.staged.push(fileName);
  return s;
}

/** Um commit local, remoto 'origin' já registrado mas nada enviado ainda. */
function withOriginRegistered(): RepoState {
  const s = withOneCommit();
  s.remotes["origin"] = "https://github.com/voce/repo.git";
  return s;
}

/** Como acima, mas já com push -u feito: origin/main == main, upstream configurado. */
function withOriginPushed(): RepoState {
  const s = withOriginRegistered();
  s.remoteBranches["origin/main"] = "c1";
  s.trackingBranches["origin/main"] = "c1";
  s.upstream["main"] = "origin/main";
  return s;
}

/** Como acima, mas alguém empurrou um commit novo direto pro remoto — local ainda não sabe. */
function withRemoteAhead(): RepoState {
  const s = withOriginPushed();
  s.commitCounter = 2;
  s.commits["c2"] = {
    id: "c2",
    parentIds: ["c1"],
    message: "correção de um colega",
    createdOnBranch: "main",
  };
  s.remoteBranches["origin/main"] = "c2";
  return s;
}

/** Um repositório remoto já existe (commit + remoteBranches), mas nada local ainda. */
function remoteOnlyRepo(): RepoState {
  const s = createInitialState();
  s.commitCounter = 1;
  s.commits["c1"] = {
    id: "c1",
    parentIds: [],
    message: "primeiro commit",
    createdOnBranch: "main",
  };
  s.remoteBranches["origin/main"] = "c1";
  return s;
}

export const CHALLENGES: Challenge[] = [
  {
    id: "init-1",
    trilha: "Fundamentos",
    title: "Comece um repositório",
    description:
      "Você acabou de criar uma pasta para um projeto novo. Inicialize um repositório git nela.",
    hint: "Pense no verbo em inglês para 'começar do zero': é o subcomando que você roda uma única vez, na raiz da pasta do projeto.",
    setup: () => createInitialState(),
    goal: (s) => s.initialized,
  },
  {
    id: "add-1",
    trilha: "Fundamentos",
    title: "Prepare uma alteração",
    description:
      "Você editou 'index.js'. Antes de gravar no histórico, é preciso preparar (stage) a alteração.",
    hint: "Antes de gravar, o git precisa saber quais arquivos entram no próximo commit. Qual subcomando 'adiciona' um arquivo a essa lista de preparação?",
    setup: () => withOneChange("index.js"),
    goal: (s) => s.staged.includes("index.js"),
  },
  {
    id: "commit-1",
    trilha: "Fundamentos",
    title: "Grave seu primeiro commit",
    description:
      "'index.js' já está preparado. Grave essa alteração no histórico com uma mensagem descritiva.",
    hint: "O subcomando que grava o que está preparado no histórico sempre pede uma mensagem descrevendo a mudança. Que flag de uma letra costuma introduzir essa mensagem entre aspas?",
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
    hint: "Você quer enxergar o passado do repositório. Qual subcomando do git mostra a lista de commits já gravados?",
    setup: () => withTwoCommits(),
    goal: (s) => s.lastCommand === "log",
  },
  {
    id: "branch-1",
    trilha: "Branching",
    title: "Crie uma branch",
    description:
      "Você vai começar uma funcionalidade nova sem afetar 'main'. Crie a branch 'feature-login'.",
    hint: "Uma branch é só um ponteiro com nome apontando para um commit. Qual subcomando cria esse ponteiro novo, seguido do nome que ele deve ter?",
    setup: () => withOneCommit(),
    goal: (s) => "feature-login" in s.branches,
  },
  {
    id: "checkout-1",
    trilha: "Branching",
    title: "Troque de branch",
    description:
      "A branch 'feature-login' já existe. Troque o HEAD para ela.",
    hint: "Existem dois subcomandos do git para mover o HEAD para outra branch já existente — um mais antigo e multiuso, outro mais novo e específico para trocar de branch. Use um deles seguido do nome da branch.",
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
    hint: "Um dos comandos de trocar de branch tem uma flag que também cria a branch antes de trocar, tudo em um único comando. Que letra costuma representar 'branch nova' logo antes do nome dela?",
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
    hint: "Você quer trazer os commits de outra branch para dentro da branch em que está agora. Qual subcomando 'junta' históricos, seguido do nome da branch de origem? Repare que 'main' não andou desde que a feature nasceu — por isso o git só precisa mover um ponteiro para frente.",
    setup: () => withBranchAhead(),
    goal: (s) => s.branches["main"] === "c2",
  },
  {
    id: "merge-1",
    trilha: "Branching",
    title: "Junte históricos que divergiram",
    description:
      "Desta vez 'main' também avançou enquanto 'feature-login' era desenvolvida. Você está em 'main': junte as duas histórias. Repare no grafo: o git vai precisar criar um commit novo, com dois pais.",
    hint: "É o mesmo subcomando do desafio anterior, mas agora as duas branches andaram cada uma pro seu lado. Como as histórias divergiram, o git não consegue só mover um ponteiro — o que ele precisa criar para reunir as duas linhas do tempo em uma só?",
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
    hint: "Você já usou o subcomando que cria branches. Ele também apaga, com uma flag diferente. Qual letra minúscula costuma significar 'delete seguro' (só remove se o trabalho já estiver mesclado em outro lugar)?",
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
    hint: "Diferente de uma branch, esse marcador não se move sozinho conforme novos commits chegam — ele fica fixo no commit onde foi criado. Qual subcomando cria esse tipo de marcador, seguido do nome dele?",
    setup: () => withOneCommit(),
    goal: (s) => "v1.0.0" in s.tags,
  },
  {
    id: "tag-a-1",
    trilha: "Tags",
    title: "Marque uma release de verdade",
    description:
      "Para releases oficiais, use uma tag anotada, que guarda mensagem e autor. Crie a tag anotada 'v2.0.0' com uma mensagem.",
    hint: "A tag do desafio anterior era 'leve' — só um nome. Para guardar também mensagem e autor, existe uma flag que a torna 'anotada'. Que letra representa isso, e qual outra flag (a mesma do commit) carrega a mensagem?",
    setup: () => withTwoCommits(),
    goal: (s) => s.tags["v2.0.0"]?.annotated === true,
  },
  {
    id: "restore-1",
    trilha: "Desfazer",
    title: "Descarte uma alteração",
    description:
      "Você editou 'index.js' por engano e quer voltar ao que estava no último commit, sem preparar nada. Descarte a alteração na área de trabalho.",
    hint: "Você quer 'devolver' o arquivo ao estado anterior na área de trabalho, sem tocar na staging area. Qual subcomando restaura um arquivo, seguido do nome dele?",
    setup: () => withOneChange("index.js"),
    goal: (s) => !s.workingChanges.includes("index.js"),
  },
  {
    id: "restore-staged-1",
    trilha: "Desfazer",
    title: "Tire da staging area sem perder a alteração",
    description:
      "Você preparou 'index.js' cedo demais. Tire-o da staging area, mas sem descartar a alteração — ela deve voltar para a área de trabalho.",
    hint: "É o mesmo subcomando do desafio anterior, mas agora você não quer descartar a alteração, só desfazer o 'add'. Que flag existe para isso?",
    setup: () => {
      const s = baseInitialized();
      s.staged.push("index.js");
      return s;
    },
    goal: (s) => s.workingChanges.includes("index.js") && !s.staged.includes("index.js"),
  },
  {
    id: "reset-soft-1",
    trilha: "Desfazer",
    title: "Desfaça o commit, mantendo tudo preparado",
    description:
      "Você commitou, mas também tinha 'extra.txt' já preparado (staged) para entrar num commit futuro. Desfaça o último commit sem perder o que já estava preparado.",
    hint: "Existe um subcomando que move o ponteiro da branch para trás no histórico. Ele tem uma variante que só mexe em qual commit a branch aponta, sem tocar em staging nem na área de trabalho — qual flag representa essa variante 'suave'?",
    setup: () => withTwoCommitsAndStaged(),
    goal: (s) => s.branches["main"] === "c1" && s.staged.includes("extra.txt"),
  },
  {
    id: "reset-mixed-1",
    trilha: "Desfazer",
    title: "Desfaça o commit e também a preparação",
    description:
      "Mesma situação: um commit feito e 'extra.txt' já preparado. Desta vez, desfaça o commit E tire 'extra.txt' da staging area — a alteração deve continuar existindo, só não preparada.",
    hint: "É o mesmo subcomando do desafio anterior. Esse é o comportamento padrão dele quando nenhuma flag de variante é passada — qual o nome dessa variante 'do meio'?",
    setup: () => withTwoCommitsAndStaged(),
    goal: (s) =>
      s.branches["main"] === "c1" &&
      s.workingChanges.includes("extra.txt") &&
      !s.staged.includes("extra.txt"),
  },
  {
    id: "reset-hard-1",
    trilha: "Desfazer",
    title: "Desfaça tudo, sem dó",
    description:
      "Mesma situação de novo. Desta vez você tem certeza: quer desfazer o commit e descartar completamente tudo que estava preparado ou modificado, sem guardar nada.",
    hint: "Mesmo subcomando, terceira variante — a mais destrutiva das três, que não deixa nada preparado nem modificado para trás. Qual flag representa 'sem piedade'?",
    setup: () => withTwoCommitsAndStaged(),
    goal: (s) =>
      s.branches["main"] === "c1" && s.staged.length === 0 && s.workingChanges.length === 0,
  },
  {
    id: "revert-1",
    trilha: "Desfazer",
    title: "Desfaça um commit sem reescrever o histórico",
    description:
      "O commit 'c2' quebrou algo em produção, mas você não pode reescrever o histórico (outras pessoas já usam esses commits). Desfaça o efeito de 'c2' criando um commit novo.",
    hint: "Diferente do subcomando das últimas três etapas (que move o ponteiro para trás), esse cria um commit novo que aplica o efeito contrário do commit indicado. Qual é, seguido do id do commit?",
    setup: () => withTwoCommits(),
    goal: (s) => {
      const tip = s.branches["main"];
      const c = tip ? s.commits[tip] : null;
      return !!c && c.message.startsWith("Revert") && c.parentIds[0] === "c2";
    },
  },
  {
    id: "clone-1",
    trilha: "Remoto",
    title: "Clone um repositório existente",
    description:
      "É o seu primeiro dia numa empresa nova: o repositório do projeto já existe no servidor remoto. Clone-o para começar a trabalhar localmente.",
    hint: "Você quer uma cópia completa de um repositório que já existe em outro lugar, incluindo a branch principal e o rastreamento configurados. Qual subcomando faz isso, seguido de uma url?",
    setup: () => remoteOnlyRepo(),
    goal: (s) => s.initialized && s.branches["main"] === "c1" && s.upstream["main"] === "origin/main",
  },
  {
    id: "remote-add-1",
    trilha: "Remoto",
    title: "Registre um repositório remoto",
    description:
      "Você criou um repositório local e agora quer conectá-lo a um servidor remoto para poder compartilhar o trabalho. Registre-o com o apelido 'origin'.",
    hint: "Existe um subcomando que gerencia as conexões com outros repositórios. Qual, seguido de 'add', um apelido e uma url?",
    setup: () => withOneCommit(),
    goal: (s) => "origin" in s.remotes,
  },
  {
    id: "push-u-1",
    trilha: "Remoto",
    title: "Envie seu trabalho pela primeira vez",
    description:
      "'origin' já está registrado, mas main' ainda não existe lá. Envie seus commits e configure o rastreamento, para que os próximos envios não precisem repetir os argumentos.",
    hint: "Qual subcomando envia commits locais para o remoto? Ele tem uma flag de uma letra que, além de enviar, já liga (configura o rastreamento entre) a branch local e a remota.",
    setup: () => withOriginRegistered(),
    goal: (s) => s.remoteBranches["origin/main"] === "c1" && s.upstream["main"] === "origin/main",
  },
  {
    id: "fetch-1",
    trilha: "Remoto",
    title: "Busque o que mudou, sem misturar ainda",
    description:
      "Um colega enviou um commit novo para 'origin/main', mas sua branch local ainda não sabe disso. Busque as novidades do remoto sem incorporar nada na sua branch ainda.",
    hint: "Existe um comando que só atualiza o que você sabe sobre o remoto (a referência 'origin/main'), sem tocar na sua branch local — diferente do comando que também incorpora as mudanças.",
    setup: () => withRemoteAhead(),
    goal: (s) => s.trackingBranches["origin/main"] === "c2" && s.branches["main"] === "c1",
  },
  {
    id: "pull-1",
    trilha: "Remoto",
    title: "Traga as novidades do remoto",
    description:
      "Mesma situação: um colega avançou 'origin/main' e sua branch local ficou pra trás. Desta vez, busque e já incorpore as novidades num único comando.",
    hint: "Existe um comando que faz fetch e merge em um único passo. Qual?",
    setup: () => withRemoteAhead(),
    goal: (s) => s.branches["main"] === "c2",
  },
];
