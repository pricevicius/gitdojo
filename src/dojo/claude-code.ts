import type { Dojo } from "./types";
import type { ClaudeCodeState } from "../engine/claude-code/types";
import { createInitialClaudeCodeState } from "../engine/claude-code/types";
import { runCommand } from "../engine/claude-code/commands";
import { CLAUDE_CODE_CHALLENGES, CLAUDE_CODE_TRILHAS_ORDER } from "../data/claude-codeChallenges";
import { CLAUDE_CODE_DICTIONARY } from "../data/claude-codeDictionary";
import ClaudeCodeVisualization from "../components/ClaudeCodeVisualization";

export const claudeCodeDojo: Dojo<ClaudeCodeState> = {
  domainSlug: "claude-code",
  subdomain: "claude",
  label: "Claude Code",
  tagline: "Confissão: quem montou esse dojo fui eu, o Claude — o Price só deu a ideia.",
  commandPrefix: "claude",
  trilhasOrder: CLAUDE_CODE_TRILHAS_ORDER,
  runCommand,
  createInitialState: createInitialClaudeCodeState,
  challenges: CLAUDE_CODE_CHALLENGES,
  dictionary: CLAUDE_CODE_DICTIONARY,
  Visualization: ClaudeCodeVisualization,
  preface: {
    title: "Antes de começar: instale o Claude Code de verdade",
    intro: [
      "Os desafios abaixo simulam o Claude Code — não precisa instalar nada para praticar aqui.",
      "Mas se quiser usar de verdade no seu terminal, os passos são:",
    ],
    steps: [
      "npm install -g @anthropic-ai/claude-code",
      "claude --version   # confere se instalou certo",
      "claude   # abre uma sessão interativa na pasta atual",
    ],
  },
};
