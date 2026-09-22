import type { Dojo } from "./types";
import { gitDojo } from "./git";
import { wpDojo } from "./wp";
import { claudeCodeDojo } from "./claude-code";
import { javaDojo } from "./java";

/** `any` apaga o TState de propósito: cada dojo mantém seu próprio estado, o
 * runtime garante que ele nunca é misturado entre dojos (ver dojo ativo em App.tsx). */
export type AnyDojo = Dojo<any>;

export const DOJOS: AnyDojo[] = [gitDojo, wpDojo, claudeCodeDojo, javaDojo];
