# Landing page do odojo.com.br

## Contexto

Hoje `odojo.com.br`, `git.odojo.com.br` e `wpcli.odojo.com.br` apontam pro mesmo deploy
(Cloudflare Pages, ver `docs/DEPLOY.md`), mas o app não diferencia domínio nenhum — todos
mostram a última aba escolhida no `dojo-switcher` (`src/App.tsx`), guardada em
`localStorage`. Este documento planeja duas coisas separadas:

1. **Roteamento por domínio** — cada domínio abrir o lugar certo.
2. **Conteúdo da home** (`odojo.com.br`) — hoje ela não existe como página própria, é só o
   dojo de git com o switcher. Precisa virar uma LP de apresentação do projeto.

Não implementa nada — é o desenho de conteúdo e estrutura, pra servir de base quando for
codar.

## 1. Roteamento por domínio

| Domínio | Comportamento |
|---|---|
| `odojo.com.br` | Home/LP (novo) — apresentação do projeto, cards linkando pros dojos |
| `git.odojo.com.br` | Abre direto o dojo de git, sem passar pela home |
| `wpcli.odojo.com.br` | Abre direto o dojo de wp-cli, sem passar pela home |

Regra de decisão no bootstrap do app (`src/App.tsx` ou um novo `src/main.tsx`):

```ts
const hostname = window.location.hostname;
const subdomain = hostname.split(".")[0]; // "odojo" (raiz) | "git" | "wpcli"

if (subdomain === "odojo" || subdomain === "www") {
  render(<LandingPage dojos={DOJOS} />);
} else {
  const dojo = DOJOS.find(d => SUBDOMAIN_BY_SLUG[d.domainSlug] === subdomain);
  render(<App initialDojo={dojo ?? DOJOS[0]} />); // fallback: git, se subdomínio não bater
}
```

O `dojo-switcher` dentro do app deixa de trocar só `state` (problema já identificado numa
conversa anterior desta sessão) e passa a navegar de verdade pro subdomínio do dojo
escolhido (`window.location.href = "https://{sub}.odojo.com.br"`), preservando a ideia de
"a URL sempre reflete o dojo ativo".

## 2. Conteúdo da home (`odojo.com.br`)

### Objetivo da página

Não é só um hub de links — é a peça que explica **por que esse projeto existe** pra quem
chega sem contexto (um recrutador, um dev que recebeu o link, alguém decidindo se
contribui). Público-alvo: devs juniores (usuários) e devs que podem querer contribuir com
um dojo novo (contribuidores).

### Narrativa (por que estamos construindo isso)

Rascunho de texto, baseado no que já está descrito no `README.md` do projeto e generalizado
pra além de git:

> **O problema**: ferramenta de linha de comando se aprende de dois jeitos ruins —
> decorando comando por comando sem entender o efeito, ou "aprendendo apanhando" direto em
> produção, quando o erro já custou caro. Isso vale pra git, mas vale pra qualquer CLI que
> vira parte do dia a dia de quem trabalha com código.
>
> **A ideia**: em vez de ler documentação, a pessoa resolve desafios reais digitando
> comandos de verdade num terminal simulado — e vê o efeito imediatamente (visualização
> específica de cada domínio: grafo de commits no git, status do site no wp-cli). Cada
> comando bem-sucedido desbloqueia um verbete no dicionário pessoal da pessoa, que vira
> referência rápida depois. Errar não tem custo — é só resetar o desafio.
>
> **Por que "Dojo"**: a mesma "casca" de terminal/desafio/dicionário serve pra qualquer CLI
> — hoje git e wp-cli, amanhã o que a comunidade quiser trazer. Não é um curso de git; é uma
> forma de treinar memória muscular de comando, generalizável.
>
> **Por que aberto/colaborativo**: o projeto não tem modelo de negócio fechado hoje — a
> aposta é que ferramentas de onboarding boas nascem de quem está aprendendo (e não só de
> quem já sabe), então PRs de trilha nova, desafio novo ou dojo novo são bem-vindos.

### Estrutura da página (seções, topo → base)

1. **Hero** — título + subtítulo curto (1-2 linhas) + CTA principal ("Comece pelo Git" →
   link pro dojo mais maduro hoje). Sem enrolação, sem scroll pra entender o que é.
2. **O problema / a ideia** — o texto acima, resumido visualmente (2-3 blocos curtos, não
   parágrafo corrido).
3. **Como funciona** — 3 passos ilustrados: `1. escolha um dojo → 2. resolva desafios no
   terminal → 3. desbloqueie o dicionário`. Reaproveita a mesma pedagogia descrita no
   README, sem reescrever do zero.
4. **Os dojos disponíveis** — grid de cards, um por domínio ativo hoje (git, wp-cli), cada
   card leva pro subdomínio dele. Cards de dojos "planejados/em breve" (ex: SQL, se citado
   em conversa) podem aparecer desabilitados, sinalizando que o projeto está crescendo.
5. **Contribua** — trecho curto adaptando a seção "Como contribuir" do README: como
   adicionar um dojo novo, link pro repo GitHub.
6. **Footer** — link do repositório, licença (se houver), sem redes sociais/tracking
   desnecessário (projeto não tem esse tipo de infra ainda).

### Fora de escopo deste documento

- Design visual (cores, tipografia) — a home deve seguir o mesmo tema escuro já usado no
  app (`src/App.css`), não introduzir um design system novo.
- Analytics/métricas de quem visita — não há decisão tomada sobre isso ainda.
- Conteúdo dos cards de dojos "planejados" além do que já foi decidido em
  `docs/PLANO_MULTI_DOJO.md` (só git e wp-cli existem de fato hoje).

## Próximos passos (quando for implementar)

1. Roteamento por domínio (seção 1) — desbloqueia a navegação correta entre dojos, que já
   foi identificada como pendente nesta sessão.
2. Componente `LandingPage` novo em `src/components/` ou `src/pages/`, seguindo a estrutura
   de seções acima.
3. Revisar o texto da narrativa com o time antes de codar o copy final — o rascunho acima é
   ponto de partida, não copy definitivo.
