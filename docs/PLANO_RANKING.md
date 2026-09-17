# Ranking global (Postgres + Redis) — base para o Dojo multi-linguagem

## Contexto

A issue [#14](https://github.com/pricevicius/gitdojo/issues/14) começou como "ranking de
usuário" e evoluiu durante o planejamento: o projeto tem a ambição de virar um "Dojo"
completo (git hoje, SQL/Java depois — qualquer coisa baseada em comando), com um único
dicionário grande de memória muscular. Um ranking só faz sentido se for **comparável
entre pessoas**, o que descarta `localStorage` puro (decisão revertida durante esta
conversa). Isso muda a categoria do projeto: hoje é um SPA 100% estático sem nenhum
backend; esta é a primeira feature que introduz servidor, banco de dados e autenticação.

Decisões já fechadas com o usuário nesta conversa:
- **Compartilhado de verdade**, não só local → precisa de backend.
- **Postgres** (dados de verdade: usuários, tentativas) **+ Redis** (leaderboard rápido).
- **Login simples** (email/senha) agora, mas o modelo de autenticação já deve nascer
  pronto pra plugar **login com Google e GitHub** depois, sem migração dolorosa.
- **Hosting**: Docker Compose local por enquanto — sem deploy público ainda; "global"
  aqui significa "compartilhado entre quem rodar essa instância" (ex: uma turma, uma
  empresa), não a internet inteira.
- **Métrica**: número de comandos até resolver o desafio (menos = melhor) — decidido
  antes da virada pra backend, continua valendo.

Esta primeira fase entrega a **infraestrutura do ranking para a trilha de git que já
existe** — não implementa motores de SQL/Java. O schema, porém, já modela um conceito
de "domínio" (`git`, e no futuro `sql`, `java`...) desde o início, para não precisar de
migração destrutiva quando o Dojo crescer.

## O que muda

### 1. Novo serviço de backend (`server/`, diretório novo na raiz do monorepo)

Stack: **Node.js + TypeScript + Express**, **Prisma** (ORM/migrations sobre Postgres —
DX mais guiada que escrever SQL na mão ou Drizzle, bom encaixe pedagógico pro público do
projeto), **ioredis** pro Redis.

```
server/
  prisma/
    schema.prisma       # User, Domain, Challenge, Attempt, ChallengeBest
  src/
    index.ts            # bootstrap do Express
    db.ts                # cliente Prisma
    redis.ts             # cliente ioredis + helpers de leaderboard (ZADD/ZREVRANGE)
    auth/
      session.ts         # sessão opaca: token aleatório -> user_id, guardado no Redis
      password.ts          # POST /auth/register, POST /auth/login (provider "password")
      providers/            # pasta vazia por enquanto — é aqui que entram
                             # google.ts / github.ts quando o OAuth for implementado
    routes/
      challenges.ts        # POST /challenges/:id/complete
      leaderboard.ts        # GET /leaderboard?domain=git, GET /me/stats
  package.json
  Dockerfile
  .env.example
```

**Por que sessão via Redis em vez de JWT**: já temos Redis no stack pra leaderboard;
reaproveitar pra sessão dá revogação simples (logout de verdade) sem precisar gerenciar
segredo/expiração de JWT. Token opaco em cookie `httpOnly`.

**Schema Postgres (Prisma), resumido** — perfil separado de credencial, no mesmo
espírito do Auth.js/NextAuth (`User` x `Account`), justamente para encaixar Google/GitHub
depois sem mexer no que já existe:
- `User` — id, displayName, createdAt. Sem email/senha aqui.
- `AuthIdentity` — id, userId, `provider` (`"password"` | `"google"` | `"github"`),
  `providerAccountId` (email, no caso de `"password"`; o `sub`/id da conta, no caso de
  OAuth), `passwordHash` (só usado quando `provider = "password"`), `email` opcional.
  Único por `(provider, providerAccountId)`. Login com Google/GitHub no futuro só
  adiciona linhas nessa tabela — nenhuma mudança no `User` nem na sessão.
- `Domain` — id, slug (`"git"`), name. Seed inicial com uma linha só.
- `Challenge` — id/slug (bate com `Challenge.id` de `src/data/challenges.ts`, ex.
  `"init-1"`), domainId, trilha. O backend não reimplementa o `goal()` — ele só valida
  que o `challengeId` existe e confia no `commandCount` que o frontend manda (aceitável
  para um projeto educacional interno; anti-cheat não é meta desta fase).
- `Attempt` — id, userId, challengeId, commandCount, completedAt. Log append-only, uma
  linha por vez que o desafio é resolvido (inclusive revisitas).
- `ChallengeBest` — (userId, challengeId) único, bestAttempts, timesCompleted. Mantido
  em upsert transacional junto com o insert de `Attempt`, pra leitura de progresso
  pessoal não precisar agregar `Attempt` toda vez.

**Redis — leaderboard**:
- Sorted set por domínio: `leaderboard:git`, member = `userId`, score = pontuação
  calculada no momento do `complete` (ver fórmula abaixo).
- `ZADD`/`ZINCRBY` no `POST /challenges/:id/complete`; `ZREVRANGE ... WITHSCORES` no
  `GET /leaderboard`, hidratando `displayName` com uma consulta Postgres pelos IDs do
  topo (só da página pedida, não a tabela toda).

**Fórmula de pontuação (v1, ajustável)**: prioriza resolver mais desafios, com bônus por
eficiência:
```
score = challenges_resolvidos * 10 - soma(bestAttempts - 1) em cada resolvido
```
Isso separa quem resolveu mais coisas (peso maior) de quem só refinou tentativas nos
mesmos poucos desafios, mas ainda recompensa eficiência via a subtração.

**Endpoints**:
- `POST /auth/register` `{ email, password, displayName }` (cria `User` + `AuthIdentity`
  com `provider: "password"`)
- `POST /auth/login` `{ email, password }` → cookie de sessão
- `POST /auth/logout`
- `POST /challenges/:challengeId/complete` `{ commandCount }` (autenticado)
- `GET /leaderboard?domain=git&limit=20`
- `GET /me/stats` (autenticado) — bests pessoais por desafio, pro painel de progresso

### 2. Orquestração local (`docker-compose.yml`, raiz)

```yaml
services:
  postgres: # imagem oficial, volume nomeado, porta 5432
  redis:    # imagem oficial, porta 6379
  api:      # build de ./server, porta 3001, depends_on postgres+redis
```
O frontend continua rodando fora do Docker via `npm run dev` (loop de hot-reload que já
existe) apontando para `VITE_API_URL=http://localhost:3001` num `.env.local`. Só o
backend + bancos entram no Compose por enquanto.

### 3. Frontend consome a API (`src/`)

- `src/api/client.ts` (novo) — `fetch` fino com a base URL de `VITE_API_URL`, funções
  `register`, `login`, `logout`, `completeChallenge`, `getLeaderboard`, `getMyStats`.
- `src/App.tsx` — ao resolver um desafio (mesmo ponto que já dispara `markSolved` hoje),
  chama `completeChallenge(challenge.id, commandCount)` se o usuário estiver logado;
  contagem de tentativas (`commandCount`, resetado em `resetChallenge`) segue igual ao
  que já estava desenhado antes da virada pra backend. `unlocked`/`solvedIds` locais
  continuam existindo do jeito que estão — eles dirigem o dicionário e os pills do
  `ChallengeNav` e não devem depender de rede.
- Novo componente `RankingPanel` — vira a segunda aba da sidebar (ao lado do
  `Dictionary`, que já virou acordeão por categoria nesta sessão), mostrando o
  leaderboard global e o "seu progresso" pessoal. Sem login, mostra um CTA simples pra
  entrar — o simulador continua 100% praticável sem conta, só o ranking exige login.
- Um modal simples de login/cadastro, reaproveitando a estética já usada no modal
  Spotlight (`.spotlight-modal` em `src/App.css`) em vez de inventar um estilo novo.

## Fora de escopo (não fazer agora)

- Motores de SQL/Java ou qualquer engine além de git — só a modelagem de "domínio" já
  entra pronta pra isso.
- Deploy público / hosting em nuvem — fica pra quando o projeto decidir abrir pra fora
  da máquina local.
- Implementar de fato os botões/fluxo de Google e GitHub, recuperação de senha e
  verificação de email — só a modelagem (`AuthIdentity` + pasta `providers/`) já entra
  pronta; o fluxo OAuth em si (biblioteca, client id/secret, callback) fica pra depois.
- Testes automatizados do backend nesta primeira fase (o frontend já tem suíte via
  `vitest`; o backend pode ganhar a dele numa iteração seguinte, depois que o formato
  dos endpoints estabilizar).

## Verificação

1. `docker compose up -d postgres redis`, depois `cd server && npx prisma migrate dev`
   pra criar o schema e rodar o seed do domínio `git`.
2. `cd server && npm run dev` (ou dentro do Compose) — subir a API na porta 3001.
3. Registrar um usuário via `curl`/HTTPie em `POST /auth/register`, depois logar.
4. `npm run dev` no frontend com `VITE_API_URL` apontando pra API; resolver um desafio
   logado e conferir no `RankingPanel` que ele aparece no leaderboard.
5. Checar direto no Redis (`redis-cli ZREVRANGE leaderboard:git 0 -1 WITHSCORES`) que o
   sorted set bate com o Postgres (`SELECT * FROM "ChallengeBest"`).
6. Rodar `npm run lint`, `npm run build` e `npm run test` do frontend pra garantir que
   nada quebrou nas partes existentes.
