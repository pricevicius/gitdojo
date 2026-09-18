import { useEffect, useState } from "react";
import type { RepoState } from "./engine/types";
import { gitDojo } from "./dojo/git";
import Terminal from "./components/Terminal";
import Dictionary from "./components/Dictionary";
import ChallengePanel from "./components/ChallengePanel";
import ChallengeNav from "./components/ChallengeNav";
import "./App.css";

// Único dojo plugado por enquanto — trocar por um seletor quando um segundo
// dojo (ex. wp-cli) existir.
const dojo = gitDojo;
const CHALLENGES = dojo.challenges;
const TRILHAS_ORDER = dojo.trilhasOrder;

interface LogLine {
  kind: "input" | "output" | "error";
  text: string;
}

const PROGRESS_KEY = "gitdojo_challenge_id";
const LEGACY_PROGRESS_KEY = "gitdojo_challenge_index";
const UNLOCKED_KEY = "gitdojo_unlocked_commands";
const SOLVED_KEY = "gitdojo_solved_challenges";

/**
 * Ordem dos desafios antes de 'git merge' entrar na trilha Branching. Versões
 * antigas salvavam o progresso como índice, então inserir um desafio no meio
 * movia o jogador de lugar; esta lista converte aquele índice no id certo.
 */
const LEGACY_ORDER = [
  "init-1",
  "add-1",
  "commit-1",
  "log-1",
  "branch-1",
  "checkout-1",
  "checkout-b-1",
  "branch-d-1",
  "tag-1",
  "tag-a-1",
];

function indexOfChallenge(id: string | null | undefined): number {
  if (!id) return 0;
  const i = CHALLENGES.findIndex((c) => c.id === id);
  return i === -1 ? 0 : i;
}

function loadProgress(): number {
  try {
    const savedId = localStorage.getItem(PROGRESS_KEY);
    if (savedId) return indexOfChallenge(savedId);

    const legacyIndex = localStorage.getItem(LEGACY_PROGRESS_KEY);
    if (legacyIndex) return indexOfChallenge(LEGACY_ORDER[parseInt(legacyIndex, 10)]);
  } catch {
    // localStorage indisponível (aba anônima, cookies bloqueados): começa do zero.
  }
  return 0;
}

function loadUnlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(UNLOCKED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function loadSolved(): Set<string> {
  try {
    const raw = localStorage.getItem(SOLVED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export default function App() {
  const [challengeIndex, setChallengeIndex] = useState(loadProgress);
  const challenge = CHALLENGES[challengeIndex];

  const [repoState, setRepoState] = useState<RepoState>(() => challenge.setup());
  const [log, setLog] = useState<LogLine[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [unlocked, setUnlocked] = useState<Set<string>>(loadUnlocked);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(loadSolved);
  const [terminalOpen, setTerminalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PROGRESS_KEY, CHALLENGES[challengeIndex].id);
      localStorage.removeItem(LEGACY_PROGRESS_KEY);
    } catch {
      // sem localStorage o progresso simplesmente não persiste.
    }
  }, [challengeIndex]);

  useEffect(() => {
    try {
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...unlocked]));
    } catch {
      // idem: o dicionário continua funcionando, só não sobrevive ao reload.
    }
  }, [unlocked]);

  const solved = challenge.goal(repoState);

  function markSolved(id: string) {
    setSolvedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(SOLVED_KEY, JSON.stringify([...next]));
      } catch {
        // idem: a marcação de resolvido não sobrevive ao reload sem localStorage.
      }
      return next;
    });
  }

  function handleRun(command: string) {
    const result = dojo.runCommand(command, repoState);
    setRepoState(result.state);
    if (result.unlockedCommand) {
      setUnlocked((prev) => {
        if (prev.has(result.unlockedCommand!)) return prev;
        const next = new Set(prev);
        next.add(result.unlockedCommand!);
        return next;
      });
    }
    if (challenge.goal(result.state)) {
      markSolved(challenge.id);
    }
    return { ok: result.ok, output: result.output };
  }

  function resetChallenge(index: number) {
    setRepoState(CHALLENGES[index].setup());
    setLog([]);
    setShowHint(false);
  }

  function goToChallenge(index: number) {
    setChallengeIndex(index);
    resetChallenge(index);
  }

  function handleNext() {
    goToChallenge(Math.min(challengeIndex + 1, CHALLENGES.length - 1));
  }

  function handleReset() {
    resetChallenge(challengeIndex);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🥋 Git Dojo</h1>
        <p>Aprenda comandos git praticando — e monte seu próprio dicionário.</p>
      </header>

      <ChallengeNav
        challenges={CHALLENGES}
        trilhasOrder={TRILHAS_ORDER}
        currentId={challenge.id}
        solvedIds={solvedIds}
        onSelect={goToChallenge}
      />

      <ChallengePanel
        challenge={challenge}
        index={challengeIndex}
        total={CHALLENGES.length}
        solved={solved}
        showHint={showHint}
        onToggleHint={() => setShowHint((v) => !v)}
        onNext={handleNext}
        onReset={handleReset}
        onOpenTerminal={() => setTerminalOpen(true)}
      />

      <main className="app-main">
        <section className="app-workspace">
          <dojo.Visualization state={repoState} />
          <Terminal
            challenge={challenge}
            solved={solved}
            onRun={handleRun}
            onNext={handleNext}
            log={log}
            setLog={setLog}
            isOpen={terminalOpen}
            setIsOpen={setTerminalOpen}
          />
        </section>
        <aside className="app-sidebar">
          <Dictionary unlocked={unlocked} currentTrilha={challenge.trilha} />
        </aside>
      </main>
    </div>
  );
}
