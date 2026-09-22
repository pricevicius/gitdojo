import { useEffect, useState } from "react";
import { DOJOS, type AnyDojo } from "./dojo/registry";
import Terminal from "./components/Terminal";
import Dictionary from "./components/Dictionary";
import ChallengePanel from "./components/ChallengePanel";
import ChallengeNav from "./components/ChallengeNav";
import RankingPanel from "./components/RankingPanel";
import AuthModal from "./components/AuthModal";
import { completeChallenge, getMe, isRankingEnabled, logout, type AuthUser } from "./api/client";
import "./App.css";

const ACTIVE_DOJO_KEY = "gitdojo_active_dojo";

interface LogLine {
  kind: "input" | "output" | "error";
  text: string;
}

const PROGRESS_KEY = "gitdojo_challenge_id";
const LEGACY_PROGRESS_KEY = "gitdojo_challenge_index";
const UNLOCKED_KEY = "gitdojo_unlocked_commands";
const SOLVED_KEY = "gitdojo_solved_challenges";

function progressKey(domainSlug: string): string {
  return `${PROGRESS_KEY}_${domainSlug}`;
}

/**
 * Ordem dos desafios de git antes de 'git merge' entrar na trilha Branching e
 * antes do progresso passar a ser escopado por dojo. Versões antigas salvavam
 * o progresso como índice; esta lista converte aquele índice no id certo.
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

function indexOfChallenge(dojo: AnyDojo, id: string | null | undefined): number {
  if (!id) return 0;
  const i = dojo.challenges.findIndex((c) => c.id === id);
  return i === -1 ? 0 : i;
}

function loadProgressIndex(dojo: AnyDojo): number {
  try {
    const savedId = localStorage.getItem(progressKey(dojo.domainSlug));
    if (savedId) return indexOfChallenge(dojo, savedId);

    if (dojo.domainSlug === "git") {
      const legacyIndex = localStorage.getItem(LEGACY_PROGRESS_KEY);
      if (legacyIndex) return indexOfChallenge(dojo, LEGACY_ORDER[parseInt(legacyIndex, 10)]);
    }
  } catch {
    // localStorage indisponível (aba anônima, cookies bloqueados): começa do zero.
  }
  return 0;
}

function loadActiveDojoIndex(forcedSlug?: string): number {
  if (forcedSlug) {
    const forced = DOJOS.findIndex((d) => d.domainSlug === forcedSlug);
    if (forced !== -1) return forced;
  }
  try {
    const slug = localStorage.getItem(ACTIVE_DOJO_KEY);
    if (!slug) return 0;
    const i = DOJOS.findIndex((d) => d.domainSlug === slug);
    return i === -1 ? 0 : i;
  } catch {
    return 0;
  }
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

interface AppProps {
  /** Dojo forçado pelo subdomínio de entrada (ver src/routing.ts), ex. "git". */
  forcedDojoSlug?: string;
}

export default function App({ forcedDojoSlug }: AppProps = {}) {
  const [dojoIndex, setDojoIndex] = useState(() => loadActiveDojoIndex(forcedDojoSlug));
  const dojo = DOJOS[dojoIndex];

  const [challengeIndex, setChallengeIndex] = useState(() => loadProgressIndex(dojo));
  const challenge = dojo.challenges[challengeIndex];

  const [engineState, setEngineState] = useState(() => challenge.setup());
  const [log, setLog] = useState<LogLine[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [unlocked, setUnlocked] = useState<Set<string>>(loadUnlocked);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(loadSolved);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [commandCount, setCommandCount] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<"dictionary" | "ranking">("dictionary");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [rankingRefresh, setRankingRefresh] = useState(0);

  useEffect(() => {
    if (!isRankingEnabled()) return;
    getMe()
      .then(setUser)
      .catch(() => {
        // sem sessão válida o ranking só mostra o CTA de login.
      });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_DOJO_KEY, dojo.domainSlug);
    } catch {
      // sem localStorage o dojo ativo simplesmente não persiste.
    }
  }, [dojo.domainSlug]);

  useEffect(() => {
    try {
      localStorage.setItem(progressKey(dojo.domainSlug), challenge.id);
      if (dojo.domainSlug === "git") localStorage.removeItem(LEGACY_PROGRESS_KEY);
    } catch {
      // sem localStorage o progresso simplesmente não persiste.
    }
  }, [dojo.domainSlug, challenge.id]);

  useEffect(() => {
    try {
      localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...unlocked]));
    } catch {
      // idem: o dicionário continua funcionando, só não sobrevive ao reload.
    }
  }, [unlocked]);

  const solved = challenge.goal(engineState);

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
    const wasSolvedBefore = challenge.goal(engineState);
    const result = dojo.runCommand(command, engineState);
    setEngineState(result.state);
    const nextCommandCount = commandCount + 1;
    setCommandCount(nextCommandCount);
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
      if (!wasSolvedBefore && user) {
        completeChallenge(dojo.domainSlug, challenge.id, nextCommandCount, challenge.trilha)
          .then(() => setRankingRefresh((n) => n + 1))
          .catch(() => {
            // resolver o desafio já ficou salvo localmente; o ranking só não atualiza agora.
          });
      }
    }
    return { ok: result.ok, output: result.output };
  }

  function resetChallenge(index: number) {
    setEngineState(dojo.challenges[index].setup());
    setLog([]);
    setShowHint(false);
    setCommandCount(0);
  }

  function goToChallenge(index: number) {
    setChallengeIndex(index);
    resetChallenge(index);
  }

  function handleNext() {
    goToChallenge(Math.min(challengeIndex + 1, dojo.challenges.length - 1));
  }

  function handleReset() {
    resetChallenge(challengeIndex);
  }

  function handleSelectDojo(index: number) {
    if (index === dojoIndex) return;
    const nextDojo = DOJOS[index];

    // Em git.odojo.com.br / wpcli.odojo.com.br a URL precisa refletir o dojo ativo, então
    // trocar de dojo é navegação de verdade pro subdomínio dele, não só troca de estado.
    // Fora desses domínios (localhost, preview do Pages) não há subdomínio de produção pra
    // ir, então mantém a troca em memória, como antes.
    const currentSubdomain = window.location.hostname.split(".")[0];
    const isProdDojoHost = DOJOS.some((d) => d.subdomain === currentSubdomain);
    if (isProdDojoHost) {
      // eslint-disable-next-line react/immutability -- navegação de browser, não estado React
      window.location.href = `https://${nextDojo.subdomain}.odojo.com.br`;
      return;
    }

    const nextChallengeIndex = loadProgressIndex(nextDojo);
    setDojoIndex(index);
    setChallengeIndex(nextChallengeIndex);
    setEngineState(nextDojo.challenges[nextChallengeIndex].setup());
    setLog([]);
    setShowHint(false);
    setCommandCount(0);
    setTerminalOpen(false);
  }

  function handleLogout() {
    logout()
      .catch(() => {
        // mesmo se a chamada falhar (sessão já expirada, rede), limpa localmente.
      })
      .finally(() => setUser(null));
  }

  return (
    <div className="app">
      {authModalOpen && (
        <AuthModal
          onClose={() => setAuthModalOpen(false)}
          onAuthed={(authedUser) => {
            setUser(authedUser);
            setAuthModalOpen(false);
          }}
        />
      )}
      <header className="app-header">
        <div className="app-header-top">
          <div>
            <h1>🥋 Dojo</h1>
            <p>Aprenda comandos de {dojo.label} praticando — e monte seu próprio dicionário.</p>
          </div>
          <div className="dojo-switcher">
            {DOJOS.map((d, i) => (
              <button
                key={d.domainSlug}
                type="button"
                className={i === dojoIndex ? "dojo-switcher-btn active" : "dojo-switcher-btn"}
                onClick={() => handleSelectDojo(i)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {dojo.preface && (
        <div className="dojo-preface">
          <h3>{dojo.preface.title}</h3>
          {dojo.preface.intro?.map((line, i) => <p key={i}>{line}</p>)}
          <pre className="dojo-preface-steps">
            <code>{dojo.preface.steps.join("\n")}</code>
          </pre>
        </div>
      )}

      <ChallengeNav
        challenges={dojo.challenges}
        trilhasOrder={dojo.trilhasOrder}
        currentId={challenge.id}
        solvedIds={solvedIds}
        onSelect={goToChallenge}
      />

      <ChallengePanel
        challenge={challenge}
        index={challengeIndex}
        total={dojo.challenges.length}
        solved={solved}
        showHint={showHint}
        onToggleHint={() => setShowHint((v) => !v)}
        onNext={handleNext}
        onReset={handleReset}
        onOpenTerminal={() => setTerminalOpen(true)}
      />

      <main className="app-main">
        <section className="app-workspace">
          <dojo.Visualization state={engineState} />
          <Terminal
            challenge={challenge}
            commandPrefix={dojo.commandPrefix}
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
          {/* Sem VITE_API_URL (build estático puro, ex. Cloudflare Pages hoje) o
              ranking não faz parte da stack — nem a aba aparece, não é só um estado
              desabilitado. */}
          {isRankingEnabled() && (
            <div className="sidebar-tabs">
              <button
                type="button"
                className={sidebarTab === "dictionary" ? "sidebar-tab active" : "sidebar-tab"}
                onClick={() => setSidebarTab("dictionary")}
              >
                📖 Dicionário
              </button>
              <button
                type="button"
                className={sidebarTab === "ranking" ? "sidebar-tab active" : "sidebar-tab"}
                onClick={() => setSidebarTab("ranking")}
              >
                🏆 Ranking
              </button>
            </div>
          )}
          {sidebarTab === "ranking" && isRankingEnabled() ? (
            <RankingPanel
              domain={dojo.domainSlug}
              dojoLabel={dojo.label}
              user={user}
              onRequestLogin={() => setAuthModalOpen(true)}
              onLogout={handleLogout}
              refreshToken={rankingRefresh}
            />
          ) : (
            <Dictionary
              dictionary={dojo.dictionary}
              categories={dojo.trilhasOrder}
              unlocked={unlocked}
              currentTrilha={challenge.trilha}
            />
          )}
        </aside>
      </main>
    </div>
  );
}
