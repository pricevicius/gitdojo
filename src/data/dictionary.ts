export interface DictionaryEntry {
  command: string;
  category: string;
  short: string;
  example: string;
}

export const DICTIONARY: Record<string, DictionaryEntry> = {
  "git init": {
    command: "git init",
    category: "Fundamentos",
    short: "Cria um repositório git novo na pasta atual.",
    example: "git init",
  },
  "git status": {
    command: "git status",
    category: "Fundamentos",
    short: "Mostra o estado atual: o que mudou, o que está preparado (staged) para commit.",
    example: "git status",
  },
  "git add": {
    command: "git add <arquivo|.>",
    category: "Fundamentos",
    short: "Move alterações da área de trabalho para a área de staging (preparadas para commit).",
    example: "git add .",
  },
  "git commit": {
    command: "git commit -m \"mensagem\"",
    category: "Fundamentos",
    short: "Grava as alterações preparadas como um novo ponto no histórico.",
    example: 'git commit -m "adiciona tela de login"',
  },
  "git log": {
    command: "git log",
    category: "Fundamentos",
    short: "Lista o histórico de commits a partir do ponto atual (HEAD).",
    example: "git log",
  },
  "git branch": {
    command: "git branch <nome>",
    category: "Branching",
    short: "Cria uma nova branch apontando para o commit atual, sem trocar para ela.",
    example: "git branch feature-login",
  },
  "git branch -d": {
    command: "git branch -d <nome>",
    category: "Branching",
    short: "Deleta uma branch que já foi mesclada (use -D para forçar).",
    example: "git branch -d feature-login",
  },
  "git checkout": {
    command: "git checkout <branch>",
    category: "Branching",
    short: "Troca o HEAD para apontar para outra branch já existente.",
    example: "git checkout main",
  },
  "git checkout -b": {
    command: "git checkout -b <nome>",
    category: "Branching",
    short: "Cria uma branch nova e já troca para ela em um único comando.",
    example: "git checkout -b feature-login",
  },
  "git switch": {
    command: "git switch <branch>",
    category: "Branching",
    short: "Forma moderna de trocar de branch (substitui parte do checkout).",
    example: "git switch main",
  },
  "git switch -c": {
    command: "git switch -c <nome>",
    category: "Branching",
    short: "Cria e troca para uma nova branch (equivalente a checkout -b).",
    example: "git switch -c feature-login",
  },
  "git merge": {
    command: "git merge <branch>",
    category: "Branching",
    short:
      "Incorpora o histórico de outra branch na branch atual. Se a sua branch não avançou, é um fast-forward (só move o ponteiro); se as duas histórias divergiram, nasce um commit de merge com dois pais.",
    example: "git merge feature-login",
  },
  "git tag": {
    command: "git tag <nome>",
    category: "Tags",
    short: "Cria uma tag leve: um apelido fixo para o commit atual (bom para marcações rápidas).",
    example: "git tag v1.0.0",
  },
  "git tag -a": {
    command: "git tag -a <nome> -m \"mensagem\"",
    category: "Tags",
    short: "Cria uma tag anotada: guarda autor, data e mensagem — recomendada para releases.",
    example: 'git tag -a v1.0.0 -m "primeira versão estável"',
  },
};

export const CATEGORIES = ["Fundamentos", "Branching", "Tags"] as const;
