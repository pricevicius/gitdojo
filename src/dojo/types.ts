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

export interface DojoChallenge<TState> {
  id: string;
  trilha: string;
  title: string;
  description: string;
  hint: string;
  setup: () => TState;
  goal: (state: TState) => boolean;
}

export interface DictionaryEntry {
  command: string;
  category: string;
  short: string;
  example: string;
}

export interface Dojo<TState> {
  /** Bate com Domain.slug no backend de ranking (ver docs/PLANO_RANKING.md). */
  domainSlug: string;
  trilhasOrder: readonly string[];
  runCommand: (input: string, prev: TState) => DojoCommandResult<TState>;
  createInitialState: () => TState;
  challenges: DojoChallenge<TState>[];
  dictionary: Record<string, DictionaryEntry>;
  Visualization: ComponentType<{ state: TState }>;
}
