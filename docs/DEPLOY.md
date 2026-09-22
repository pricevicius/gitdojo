# Deploy — Cloudflare Pages

## Onde roda

O projeto é um SPA estático (Vite/React), sem backend por enquanto. Hospedado no
**Cloudflare Pages**, projeto `gitdojo`, com domínios apontando pro mesmo deploy:

- `odojo.com.br` — home, explica o projeto e linka pros dojos.
- `git.odojo.com.br` — abre direto o dojo de git.
- `wpcli.odojo.com.br` — abre direto o dojo de wp-cli.
- `claude.odojo.com.br` — abre direto o dojo de Claude Code. **Ainda não criado no
  Cloudflare** (ver "Pendente" abaixo) — até lá o dojo só existe em dev/preview.

É **um único build/deploy**: o app decide o que renderizar olhando
`window.location.hostname` no client-side (ver `docs/PLANO_MULTI_DOJO.md`). Não existe
deploy separado por dojo — um dojo novo (ex: MySQL) é só código novo mais um domínio
adicionado ao mesmo projeto, não uma infraestrutura nova.

## SEO / preview de link por domínio

Como o roteamento é client-side, o `index.html` sozinho não consegue ter um
`<title>`/Open Graph diferente por domínio — crawler de link preview (WhatsApp, Slack,
Twitter) não executa JS, só lê o HTML puro. Isso é resolvido por
[functions/_middleware.ts](../functions/_middleware.ts), uma **Cloudflare Pages
Function**: intercepta a resposta HTML antes de sair e reescreve `<title>`,
`description` e as tags `og:*`/`twitter:*` de acordo com o hostname da request, usando
`HTMLRewriter` (API nativa do Workers runtime, sem SSR de verdade). As imagens de
preview (1200×630) ficam em `public/og/{root,git,wpcli,claude}.png`. Host desconhecido
(preview do Cloudflare Pages, IP) cai no conteúdo genérico do `index.html`.

`functions/` é convenção do Cloudflare Pages — o `wrangler pages deploy` detecta e
builda essa pasta sozinho, sem passo extra no `deploy.yml`. Pra testar localmente:
`npm run build && npx wrangler pages dev dist`.

## CI/CD

[.github/workflows/deploy.yml](../.github/workflows/deploy.yml) builda e publica a cada
push na `main`:

```
push na main → npm ci → npm run build → wrangler pages deploy dist
```

Usa dois GitHub Secrets no repo (`Settings → Secrets and variables → Actions`):

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Fluxo esperado pra quem for adicionar um dojo novo (ex: MySQL): abrir PR implementando o
`Dojo` (contrato em `docs/PLANO_MULTI_DOJO.md`), revisar, merge na `main` — o deploy sobe
sozinho, sem ninguém rodar comando manual.

## O que a PR de um dojo novo precisa trazer

Como registrar o subdomínio é manual (ver "Setup feito" abaixo), a descrição da PR precisa
dar ao mantenedor o que falta pra fazer isso sem ida e volta. O template
(`.github/PULL_REQUEST_TEMPLATE.md`) já pede isso, mas resumindo o porquê de cada campo:

- **O que foi feito**: resumo do dojo (ferramenta, trilhas/desafios cobertos) — contexto
  rápido pra quem for revisar sem precisar ler todo o diff primeiro.
- **Domínio desejado**: o subdomínio que a pessoa quer pro dojo dela (ex: `docker` →
  `docker.odojo.com.br`). Sem isso o mantenedor não sabe qual custom domain criar no
  Cloudflare Pages depois do merge.
- **Perfil do LinkedIn (opcional)**: se a pessoa quiser crédito público pela contribuição
  (ex: menção na landing page ou em redes do projeto). Fica de fora se ela preferir não
  informar — não é requisito pra aprovar a PR.

## Setup feito (histórico, não precisa repetir)

1. Criado projeto Pages via `wrangler pages project create gitdojo --production-branch
   main --force` (o `--force` só é necessário na criação, por causa da migração do Pages
   pra dentro de Workers — comandos seguintes não precisam).
2. Custom domains adicionados via API (`POST
   /accounts/:id/pages/projects/gitdojo/domains`), um request por domínio — o `wrangler`
   ainda não tem subcomando de CLI pra isso.
3. Token de API: criado manualmente no dashboard Cloudflare (My Profile → API Tokens),
   escopo mínimo: `Account / Cloudflare Pages / Edit` + `Zone / DNS / Edit` restrito à
   zona `odojo.com.br`. Sem esse token não é possível reproduzir os passos acima.

## Pendente: subdomínio do Claude Code

O dojo `claude-code` já está no código (visível em dev/preview) mas falta o passo manual
de infra pra `claude.odojo.com.br` responder — mesmo passo 2 de "Setup feito" acima,
repetido pro domínio novo:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/gitdojo/domains" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"claude.odojo.com.br"}'
```

Isso cria o custom domain no projeto Pages; o DNS (CNAME pra `gitdojo.pages.dev`) costuma
ser criado junto quando a zona já está no mesmo Cloudflare account, mas vale conferir em
`DNS → Records` da zona `odojo.com.br` depois. Precisa do token com o mesmo escopo
descrito em "Setup feito" (`Account / Cloudflare Pages / Edit` + `Zone / DNS / Edit`).

## Como fazer deploy manual (sem esperar o CI)

```bash
npm run build
npx wrangler pages deploy dist --project-name gitdojo --branch main
```

Precisa de `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no ambiente.

## Quando isso deixa de bastar

Quando o backend do ranking (Postgres + Redis, ver `docs/PLANO_RANKING.md`) sair do
papel, entra a necessidade de uma VPS (recomendação: Hetzner CX22, ~€4,50/mês) rodando os
serviços via Docker Compose — o frontend estático continua no Cloudflare Pages, só o
backend passa a ter infraestrutura própria.
