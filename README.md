# 🥋 Git Dojo

Um jogo web para ensinar comandos e conceitos de git na prática — feito para ajudar devs juniores a construir memória muscular com git de forma visual, sem depender só de decoreba ou de "aprender apanhando" em produção.

## A ideia

Em vez de ler documentação ou decorar comandos, a pessoa resolve desafios reais digitando comandos git num terminal simulado, e vê o efeito imediatamente em um grafo de commits/branches/tags. Cada comando executado com sucesso desbloqueia um verbete num **dicionário pessoal** — um glossário que vai sendo construído pelo próprio aprendizado, servindo de referência rápida depois.

**Ordem pedagógica proposta:** primeiro o comando (o "vocabulário"), depois — em uma camada futura — as boas práticas e regras (quando/por que usar cada um). A ideia é que, ao aprender as boas práticas, a pessoa já saiba exatamente quais comandos usar para aplicá-las.

## Como funciona hoje

- **Terminal simulado**: interpreta comandos git reais (`git init`, `git add`, `git commit -m "..."`, `git branch`, `git checkout`, `git switch`, `git tag`, etc.) e responde com mensagens parecidas com as do git de verdade.
- **Grafo de commits em SVG**: desenha commits, branches (com HEAD destacado) e tags, atualizando a cada comando.
- **Trilhas de desafios**: sequência de exercícios agrupados por tema (Fundamentos → Branching → Tags), cada um com descrição do cenário e uma dica opcional.
- **Dicionário pessoal**: sidebar que mostra os comandos já desbloqueados (com explicação curta + exemplo) e mantém os ainda não aprendidos como "🔒 ???". Progresso salvo em `localStorage`.

> **Importante:** o simulador de git **não usa o git de verdade** (nem `isomorphic-git`). É uma engine própria em memória (`src/engine`) que modela um subconjunto de comandos/estado de forma simplificada — trade-off consciente para ter controle total sobre mensagens de erro e feedback pedagógico, mas significa que o comportamento pode divergir do git real em casos avançados (ex: sem staging por arquivo de verdade, sem merge/rebase ainda).

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript
- Sem backend — tudo roda no navegador, estado local em `localStorage`
- CSS puro (sem framework de UI), tema escuro fixo

## Rodando localmente

Pré-requisito: Node.js (recomendado via [nvm](https://github.com/nvm-sh/nvm)).

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

Outros comandos úteis:

```bash
npm run build      # build de produção em dist/
npm run test        # testes do engine e dos desafios (vitest)
npx tsc --noEmit   # type-check sem gerar arquivos
```

## Estrutura do projeto

```
src/
  engine/
    types.ts        # modelo de estado do repositório (commits, branches, tags, HEAD...)
    commands.ts      # parser + executor dos comandos git suportados
  data/
    challenges.ts    # definição das trilhas e desafios (setup inicial + condição de vitória)
    dictionary.ts     # conteúdo dos verbetes do dicionário, por comando
  components/
    Terminal.tsx      # input de comando + histórico de saída
    Graph.tsx          # renderização SVG do grafo de commits/branches/tags
    Dictionary.tsx      # sidebar do dicionário pessoal
    ChallengePanel.tsx   # card do desafio atual (descrição, dica, progresso)
  App.tsx             # orquestra estado do repo, progresso e desafio atual
```

## Como contribuir

### Adicionar um novo comando git suportado

1. Implemente o handler em `src/engine/commands.ts` (siga o padrão dos `handleX` existentes) e registre no `switch` de `runCommand`.
2. Adicione o verbete correspondente em `src/data/dictionary.ts` — a chave usada em `ok(state, output, "git seu-comando")` precisa bater com a chave do dicionário.
3. Crie pelo menos um desafio em `src/data/challenges.ts` que force o uso desse comando.

### Adicionar uma nova trilha (ex: Merge & Conflitos, Rebase, Remoto)

1. Estenda o estado do repositório em `src/engine/types.ts` se precisar de novos conceitos (ex: conflitos, remote tracking).
2. Implemente os comandos necessários (ver acima).
3. Adicione os desafios da trilha em `src/data/challenges.ts`, seguindo a ordem de dificuldade.
4. Inclua a trilha em `TRILHAS_ORDER` (mesmo arquivo) e em `CATEGORIES` no dicionário, se fizer sentido categorizar os comandos novos separadamente.

### Ideias já mapeadas para próximos passos

- Trilhas de **Merge & Conflitos** e **Rebase** (`git merge`, resolução de conflito, `git rebase -i`, `git cherry-pick`)
- Trilha de **Remoto** (`git clone`, `git push`, `git pull`, `git fetch`)
- Camada extra de **Boas Práticas**, desbloqueada depois de uma base de comandos already aprendida, linkando cada prática aos comandos do dicionário que ela usa
- Persistência do progresso em conta/backend (hoje é só `localStorage`, por navegador)

Pull requests são bem-vindos — a ideia é que esse projeto vire uma ferramenta de onboarding real para times, então feedback de quem está aprendendo (e não só de quem já sabe git) é especialmente valioso.
