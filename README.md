# 🥋 Dojo

Treine comandos de linha de comando praticando de verdade — não decorando.
Hoje: **git** e **wp-cli**. Amanhã, o que a comunidade trouxer.

→ https://odojo.com.br

## De onde veio o nome do repositório

Isso nasceu como "Git Dojo": eu não lembrava o comando pra importar um
submódulo no git — de novo — e resolvi fazer um lugar pra treinar isso.
Quando o primeiro dojo ficou de pé, ficou claro que a estrutura (terminal
simulado + desafio + dicionário) não tinha nada de específico de git, e
serviria pra qualquer CLI. O produto virou Dojo; o repositório continua
`gitdojo`, porque foi de onde a ideia saiu.

## A ideia

Ferramenta de linha de comando se aprende de dois jeitos ruins: decorando
comando por comando sem entender o efeito, ou apanhando direto em produção,
quando o erro já custou caro.

Aqui você resolve desafios digitando comandos de verdade num terminal
simulado e vê o efeito na hora. Errar não custa nada — é só resetar o
desafio. Cada comando que você domina vira um verbete no seu dicionário
pessoal, que fica como referência depois.

A sequência prioriza o comando ("vocabulário") antes das boas práticas e do
quando/por que usar cada um.

## Como funciona hoje

- **Terminal simulado**: interpreta comandos git reais (`git init`, `git add`, `git commit -m "..."`, `git branch`, `git checkout`, `git switch`, `git tag`, etc.) e responde com mensagens parecidas com as do git de verdade.
- **Grafo de commits em SVG**: desenha commits, branches (com HEAD destacado) e tags, atualizando a cada comando.
- **Trilhas de desafios**: sequência de exercícios agrupados por tema (Fundamentos → Branching → Tags → Desfazer → Remoto → Submódulos → Stash → Inspeção → Arquivos → Avançado), cada um com descrição do cenário e uma dica opcional.
- **Dicionário pessoal**: sidebar que mostra os comandos já desbloqueados (com explicação curta + exemplo) e mantém os ainda não aprendidos como "🔒 ???". Progresso salvo em `localStorage`.

> **Importante:** o simulador de git **não usa o git de verdade** (nem `isomorphic-git`). É uma engine própria em memória (`src/engine`) que modela um subconjunto de comandos/estado de forma simplificada — trade-off consciente para ter controle total sobre mensagens de erro e feedback pedagógico, mas significa que o comportamento pode divergir do git real em casos avançados (ex: sem staging por arquivo de verdade, sem merge/rebase ainda). O dojo de wp-cli tem sua própria engine, seguindo o mesmo contrato.

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

## Ranking (opcional, precisa de backend)

Sem nada configurado, o dojo continua 100% estático — o ranking só some (mostra um CTA
avisando que está indisponível). Pra rodar o ranking localmente:

```bash
docker compose up -d postgres redis   # sobe só os bancos
cd server
cp .env.example .env
npm install
npm run prisma:migrate                 # cria o schema
npm run prisma:seed                    # cria os domínios (git, wp-cli)
npm run dev                            # API em http://localhost:3001
```

No frontend, crie `.env.local` na raiz com `VITE_API_URL=http://localhost:3001` e rode
`npm run dev` normalmente. Detalhes de schema, endpoints e decisões em
[docs/PLANO_RANKING.md](docs/PLANO_RANKING.md).

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

### Criando um dojo novo (outra ferramenta de CLI)

O projeto é multi-ferramenta: qualquer CLI (docker, kubectl, npm, ...) pode virar um dojo
implementando o contrato `Dojo<TState>` definido em `src/dojo/types.ts` — o mesmo que git e
wp-cli já implementam (`src/dojo/git.ts`, `src/dojo/wp.ts`). Para começar:

```bash
npm run create-dojo -- --slug docker --subdomain docker --label Docker --prefix docker
```

Isso gera o esqueleto todo (`src/engine/docker/`, `src/data/dockerChallenges.ts`,
`src/data/dockerDictionary.ts`, `src/components/DockerVisualization.tsx`,
`src/dojo/docker.ts`) e já registra o dojo em `src/dojo/registry.ts`. O que falta é
substituir os stubs por conteúdo de verdade:

1. Implemente os comandos reais em `src/engine/<slug>/commands.ts` (siga o padrão de
   `src/engine/wp/commands.ts`).
2. Escreva os desafios em `src/data/<slug>Challenges.ts`, cobrindo toda trilha declarada em
   `<SLUG>_TRILHAS_ORDER`.
3. Complete o dicionário em `src/data/<slug>Dictionary.ts` — uma entrada por comando
   desbloqueável.
4. Troque a visualização stub em `src/components/<Slug>Visualization.tsx` por algo que
   represente o estado da ferramenta (ver `Graph.tsx` e `WpStatus.tsx` como referência).
5. Rode `npm run test` — há um teste de contrato (`src/dojo/contract.test.ts`) que valida
   automaticamente que o dojo novo está bem-formado (trilhas cobertas, dicionário não vazio,
   `runCommand`/`createInitialState` não lançam exceção) — e `npx tsc --noEmit`.

### Como a sua PR vira produção

1. Abra a PR — o checklist em `.github/PULL_REQUEST_TEMPLATE.md` aparece automaticamente.
2. Um mantenedor revisa e aprova. **Toda PR passa por aprovação antes do merge**, não tem
   deploy automático a partir de um fork/branch não mergeada.
3. Depois do merge na `main`, o build e o deploy pro Cloudflare Pages acontecem sozinhos via
   GitHub Actions (`.github/workflows/deploy.yml`) — ver `docs/DEPLOY.md`. Você não precisa
   rodar nenhum comando de deploy.
4. **Exceção — dojo novo com subdomínio próprio** (ex: `docker.odojo.com.br`): criar esse
   domínio no Cloudflare Pages e o DNS correspondente é manual, feito por um mantenedor que
   tem o token de API (`docs/DEPLOY.md`, seção "Setup feito"). Isso não é automatizável a
   partir da PR — o wrangler ainda não tem um subcomando de CLI pra registrar custom domains.
   Até isso ser feito, o dojo já existe no código (visível em dev/preview) mas só fica
   acessível no subdomínio depois desse passo manual.

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
- Camada extra de **Boas Práticas**, desbloqueada depois de uma base de comandos já aprendida, linkando cada prática aos comandos do dicionário que ela usa

Pull requests são bem-vindos — a ideia é que esse projeto vire uma ferramenta de onboarding real, então feedback de quem está aprendendo (e não só de quem já sabe git) é especialmente valioso.
