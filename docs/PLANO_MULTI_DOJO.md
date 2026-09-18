# Dojo multi-linguagem: git + wp-cli e o impacto no ranking

## Contexto

O projeto é hoje um simulador só de git ("Git Dojo"). Surgiu a ideia de o projeto virar um
"Dojo" mais genérico, com outras trilhas baseadas em comando além de git — o exemplo
concreto é um dojo de **WP-CLI**. Antes de sair implementando, este documento avalia o
impacto dessa ideia sobre o que já foi planejado em `docs/PLANO_RANKING.md` (hoje só na
branch `plan/ranking-usuario`, ainda não mesclado em `main`), já que aquele foi o primeiro
plano a desenhar schema de backend/banco — decisão errada ali é cara de migrar depois de ir
para produção. Este documento é uma avaliação/decisão, não um plano de implementação: não
mexe em código do engine nem do backend.

## O que já é agnóstico de domínio hoje

Lendo `src/`, a "casca" de UI já não é acoplada a git:
- `trilha` em [ChallengeNav.tsx](../src/components/ChallengeNav.tsx) e
  [Dictionary.tsx](../src/components/Dictionary.tsx) é só uma `string`.
- `DictionaryEntry` (`src/data/dictionary.ts`) não tem nada git-específico: `command`,
  `category`, `short`, `example` servem para qualquer CLI.
- `App.tsx`, `ChallengeNav.tsx`, `ChallengePanel.tsx`, `Dictionary.tsx` e `Terminal.tsx` só
  orquestram desafio/estado/navegação — não fazem parsing de comando nem sabem o que é um
  commit.

Ou seja: navegação, painel de desafio, terminal (a "casca") não precisariam mudar para um
segundo dojo entrar. Isso reduz bastante o risco da ideia.

## O que é acoplado a git hoje

- [src/engine/types.ts](../src/engine/types.ts) — `RepoState` modela especificamente um
  repositório git (commits, branches, staged, remotes...).
- [src/engine/commands.ts](../src/engine/commands.ts) — só entende tokens que começam com
  `"git"`, com um `switch` de subcomandos git.
- [src/components/Graph.tsx](../src/components/Graph.tsx) — desenha um grafo de commits;
  não faria sentido para um dojo de wp-cli (que não tem essa noção).
- [src/data/challenges.ts](../src/data/challenges.ts) e
  [src/data/dictionary.ts](../src/data/dictionary.ts) — conteúdo (desafios/comandos)
  específico de git.

## Contrato de "dojo" proposto (para quando o wp-cli for de fato iniciado)

Não implementado agora — só o desenho de onde a costura ficaria, para não reabrir a casca
de UI depois:

```
Dojo = {
  domainSlug: string;          // "git", "wp-cli" — bate com Domain.slug do backend
  runCommand: (input, state) => CommandResult;
  createInitialState: () => EngineState;
  challenges: Challenge[];     // mesmo shape de hoje, já com trilha
  dictionary: Record<string, DictionaryEntry>;
  Visualization: React.ComponentType<{ state: EngineState }>; // Graph hoje, outra coisa no wp-cli
}
```

`App.tsx` passaria a receber o `Dojo` ativo como parâmetro (hoje importa `CHALLENGES` e
`runCommand` direto de git) — o resto da casca (`ChallengeNav`, `ChallengePanel`,
`Dictionary`, `Terminal`) já funciona sem alteração porque só depende de `trilha` (string) e
`DictionaryEntry` (genérico).

## Lacunas encontradas ao cruzar com `docs/PLANO_RANKING.md`

1. **Unicidade de `Challenge.slug` não está escopada por domínio.** O plano descreve
   `Challenge` com slug batendo com `Challenge.id` de `src/data/challenges.ts` (ex.
   `init-1`), mas não deixa explícito que a unicidade é `(domainId, slug)` e não o slug
   sozinho. Hoje não quebra nada (um domínio só), mas um dojo de wp-cli terá desafios
   chamados `init-1` também (padrão de nome natural) — um `@unique` global no slug vira
   colisão. Corrigir isso é uma linha de texto agora (schema Prisma ainda nem existe);
   depois de haver dados em produção vira migração.
2. **Leaderboard por domínio já está certo, só falta deixar o contrato do frontend
   explícito.** `GET /leaderboard?domain=git` já é parametrizado por domínio — nenhuma
   mudança de backend necessária. Ajuste recomendado: `RankingPanel` e `api/client.ts` já
   nascerem recebendo `domain` como parâmetro explícito (fixo em `"git"` por enquanto), em
   vez de assumir implicitamente que só existe um dojo. Evita reabrir esse componente
   quando o segundo dojo chegar.
3. **O contrato de "dojo" acima não é necessário para a fase 1 do ranking.** Aquela fase já
   está corretamente escopada só para a trilha de git existente ("Fora de escopo: motores
   de SQL/Java ou qualquer engine além de git"). **Não há bloqueio**: dá para implementar o
   backend de ranking como desenhado, sem esperar a refatoração multi-dojo do frontend.

## Decisão

- Seguir com `docs/PLANO_RANKING.md` como está, com duas correções pontuais a aplicar
  quando aquela branch for retomada: unicidade `(domainId, slug)` em `Challenge`, e
  `domain` explícito nas chamadas de `RankingPanel`/`api/client.ts`.
- O dojo de wp-cli (ou qualquer outro) fica para uma iteração futura, usando o contrato de
  `Dojo` acima como ponto de partida — não faz parte deste documento nem do ranking.
