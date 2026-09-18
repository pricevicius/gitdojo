# Deploy — Cloudflare Pages

## Onde roda

O projeto é um SPA estático (Vite/React), sem backend por enquanto. Hospedado no
**Cloudflare Pages**, projeto `gitdojo`, com 3 domínios apontando pro mesmo deploy:

- `odojo.com.br` — home, explica o projeto e linka pros dojos.
- `git.odojo.com.br` — abre direto o dojo de git.
- `wpcli.odojo.com.br` — abre direto o dojo de wp-cli.

É **um único build/deploy**: o app decide o que renderizar olhando
`window.location.hostname` no client-side (ver `docs/PLANO_MULTI_DOJO.md`). Não existe
deploy separado por dojo — um dojo novo (ex: MySQL) é só código novo mais um domínio
adicionado ao mesmo projeto, não uma infraestrutura nova.

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
