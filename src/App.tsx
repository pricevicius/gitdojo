import { useEffect, useState } from "react";
import type { RepoState } from "./engine/types";
import { runCommand } from "./engine/commands";
import { CHALLENGES } from "./data/challenges";
import Terminal from "./components/Terminal";
import Graph from "./components/Graph";
import Dictionary from "./components/Dictionary";
import ChallengePanel from "./components/ChallengePanel";
import "./App.css";

interface LogLine {
  kind: "input" | "output" | "error";
  text: string;
}

const PROGRESS_KEY = "gitdojo_challenge_id";
const LEGACY_PROGRESS_KEY = "gitdojo_challenge_index";
const UNLOCKED_KEY = "gitdojo_unlocked_commands";

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

export default function App() {
  const [challengeIndex, setChallengeIndex] = useState(loadProgress);
  const challenge = CHALLENGES[challengeIndex];

  const [repoState, setRepoState] = useState<RepoState>(() => challenge.setup());
  const [log, setLog] = useState<LogLine[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [unlocked, setUnlocked] = useState<Set<string>>(loadUnlocked);

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

  function handleRun(command: string) {
    const result = runCommand(command, repoState);
    setRepoState(result.state);
    if (result.unlockedCommand) {
      setUnlocked((prev) => {
        if (prev.has(result.unlockedCommand!)) return prev;
        const next = new Set(prev);
        next.add(result.unlockedCommand!);
        return next;
      });
    }
    return { ok: result.ok, output: result.output };
  }

  function resetChallenge(index: number) {
    setRepoState(CHALLENGES[index].setup());
    setLog([]);
    setShowHint(false);
  }

  function handleNext() {
    const nextIndex = Math.min(challengeIndex + 1, CHALLENGES.length - 1);
    setChallengeIndex(nextIndex);
    resetChallenge(nextIndex);
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

      <ChallengePanel
        challenge={challenge}
        index={challengeIndex}
        total={CHALLENGES.length}
        solved={solved}
        showHint={showHint}
        onToggleHint={() => setShowHint((v) => !v)}
        onNext={handleNext}
        onReset={handleReset}
      />

      <main className="app-main">
        <section className="app-workspace">
          <Graph state={repoState} />
          <Terminal challenge={challenge} onRun={handleRun} log={log} setLog={setLog} />
        </section>
        <aside className="app-sidebar">
          <Dictionary unlocked={unlocked} />
        </aside>
      </main>
    </div>
  );
}
