import type { ComponentType } from "react";

/**
 * Contrato que qualquer dojo (git, e futuramente outros como wp-cli) precisa
 * implementar para ser plugado no App: o motor que interpreta comandos e
 * mantém um estado, os desafios que usam esse estado, o dicionário de
 * comandos e a visualização própria daquele estado (grafo de commits hoje,
 * outra coisa em outros dojos).
 */

export interface DojoCommandResult<TState> {
  ok: boolean;
  output: string[];
  state: TState;
  unlockedCommand?: string;
}

/**
 * Campos de um desafio que não dependem do TState de um dojo específico —
 * é o que a casca de UI (ChallengeNav, ChallengePanel, Terminal) consome,
 * então essas telas funcionam com o desafio de qualquer dojo sem genéricos.
 */
export interface ChallengeMeta {
  id: string;
  trilha: string;
  title: string;
  description: string;
  hint: string;
}

export interface DojoChallenge<TState> extends ChallengeMeta {
  setup: () => TState;
  goal: (state: TState) => boolean;
}

export interface DictionaryEntry {
  command: string;
  category: string;
  short: string;
  example: string;
}

export interface DojoPreface {
  title: string;
  intro?: string[];
  /** Comandos reais de instalação/preparo — não é um desafio, não é avaliado. */
  steps: string[];
}

export interface Dojo<TState> {
  /** Bate com Domain.slug no backend de ranking (ver docs/PLANO_RANKING.md). */
  domainSlug: string;
  /** Primeiro rótulo do hostname que abre esse dojo direto, ex. "git" em git.odojo.com.br. */
  subdomain: string;
  label: string;
  /** Frase curta e pessoal exibida no card do dojo na landing page — opcional, use quando fizer sentido dar um tom mais direto/autoral àquele dojo específico. */
  tagline?: string;
  /** Nome do binário digitado no terminal (ex. "git", "wp") — só para placeholder/UI. */
  commandPrefix: string;
  trilhasOrder: readonly string[];
  runCommand: (input: string, prev: TState) => DojoCommandResult<TState>;
  createInitialState: () => TState;
  challenges: DojoChallenge<TState>[];
  dictionary: Record<string, DictionaryEntry>;
  Visualization: ComponentType<{ state: TState }>;
  /** Passo a passo real de instalação da ferramenta, mostrado antes do primeiro desafio. */
  preface?: DojoPreface;
}
