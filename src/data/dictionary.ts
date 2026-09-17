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
  "git restore": {
    command: "git restore <arquivo>",
    category: "Desfazer",
    short: "Descarta a alteração de um arquivo na área de trabalho, voltando ao que estava no último commit.",
    example: "git restore index.js",
  },
  "git restore --staged": {
    command: "git restore --staged <arquivo>",
    category: "Desfazer",
    short: "Tira um arquivo da área de staging, sem perder a alteração (ela volta pra área de trabalho).",
    example: "git restore --staged index.js",
  },
  "git reset --soft": {
    command: "git reset --soft <commit>",
    category: "Desfazer",
    short: "Move a branch atual para outro commit, mas mantém tudo preparado (staged) — as alterações dos commits desfeitos ficam prontas pra recommitar.",
    example: "git reset --soft HEAD~1",
  },
  "git reset --mixed": {
    command: "git reset --mixed <commit>  (ou só 'git reset <commit>')",
    category: "Desfazer",
    short: "Move a branch atual para outro commit e tira tudo da staging area — as alterações continuam no working directory, só sem estar preparadas.",
    example: "git reset HEAD~1",
  },
  "git reset --hard": {
    command: "git reset --hard <commit>",
    category: "Desfazer",
    short: "Move a branch atual para outro commit e descarta staging e working directory por completo. Destrutivo: o que não foi commitado se perde.",
    example: "git reset --hard HEAD~1",
  },
  "git revert": {
    command: "git revert <commit>",
    category: "Desfazer",
    short: "Desfaz um commit criando um commit novo que aplica o efeito contrário, sem reescrever o histórico existente.",
    example: "git revert c2",
  },
  "git remote add": {
    command: "git remote add <nome> <url>",
    category: "Remoto",
    short: "Registra um repositório remoto com um apelido (por convenção, 'origin').",
    example: "git remote add origin https://github.com/usuario/repo.git",
  },
  "git push": {
    command: "git push <remoto> <branch>",
    category: "Remoto",
    short: "Envia os commits da branch local para a branch correspondente no remoto.",
    example: "git push origin main",
  },
  "git push -u": {
    command: "git push -u <remoto> <branch>",
    category: "Remoto",
    short: "Envia e também configura a branch local para rastrear a branch remota — depois disso, um 'git push' sozinho já sabe pra onde ir.",
    example: "git push -u origin main",
  },
  "git fetch": {
    command: "git fetch [remoto]",
    category: "Remoto",
    short: "Busca o que há de novo no remoto e atualiza a referência de rastreamento (ex: origin/main) — sem tocar na sua branch local.",
    example: "git fetch",
  },
  "git pull": {
    command: "git pull",
    category: "Remoto",
    short: "Busca o que há de novo no remoto (como o fetch) e já incorpora na branch atual — vira fast-forward ou commit de merge, dependendo se a branch local também avançou.",
    example: "git pull",
  },
  "git clone": {
    command: "git clone <url>",
    category: "Remoto",
    short: "Cria uma cópia local completa de um repositório remoto, já com a branch principal e o rastreamento configurados.",
    example: "git clone https://github.com/usuario/repo.git",
  },
};

export const CATEGORIES = ["Fundamentos", "Branching", "Tags", "Desfazer", "Remoto"] as const;
