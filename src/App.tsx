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

const PROGRESS_KEY = "gitdojo_challenge_index";
const UNLOCKED_KEY = "gitdojo_unlocked_commands";

function loadProgress(): number {
  const raw = localStorage.getItem(PROGRESS_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 && n < CHALLENGES.length ? n : 0;
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
    localStorage.setItem(PROGRESS_KEY, String(challengeIndex));
  }, [challengeIndex]);

  useEffect(() => {
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...unlocked]));
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
          <Terminal onRun={handleRun} log={log} setLog={setLog} />
        </section>
        <aside className="app-sidebar">
          <Dictionary unlocked={unlocked} />
        </aside>
      </main>
    </div>
  );
}
