import { useEffect, useState } from "react";
import {
  ApiError,
  GLOBAL_DOMAIN,
  getLeaderboard,
  getMyStats,
  type AuthUser,
  type LeaderboardEntry,
} from "../api/client";

interface Props {
  domain: string;
  dojoLabel: string;
  user: AuthUser | null;
  onRequestLogin: () => void;
  onLogout: () => void;
  /** Incrementado toda vez que um desafio é resolvido, pra recarregar o leaderboard. */
  refreshToken: number;
}

export default function RankingPanel({ domain, dojoLabel, user, onRequestLogin, onLogout, refreshToken }: Props) {
  const [scope, setScope] = useState<"domain" | "global">("domain");
  const effectiveDomain = scope === "global" ? GLOBAL_DOMAIN : domain;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getLeaderboard(effectiveDomain)
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "falha ao carregar ranking");
      });

    if (user) {
      getMyStats(effectiveDomain)
        .then((res) => {
          if (!cancelled) {
            setMyScore(res.score);
            setMyRank(res.rank);
          }
        })
        .catch(() => {
          // sem stats pessoais o leaderboard geral continua útil.
        });
    } else {
      setMyScore(null);
      setMyRank(null);
    }

    return () => {
      cancelled = true;
    };
  }, [effectiveDomain, user, refreshToken]);

  return (
    <div className="ranking-panel">
      <h2>🏆 Ranking</h2>

      <div className="ranking-scope">
        <button
          type="button"
          className={scope === "domain" ? "ranking-scope-btn active" : "ranking-scope-btn"}
          onClick={() => setScope("domain")}
        >
          {dojoLabel}
        </button>
        <button
          type="button"
          className={scope === "global" ? "ranking-scope-btn active" : "ranking-scope-btn"}
          onClick={() => setScope("global")}
        >
          Geral (todos os dojos)
        </button>
      </div>

      {!user ? (
        <div className="ranking-cta">
          <p>Entre pra aparecer no leaderboard e acompanhar seu progresso.</p>
          <button type="button" className="btn-primary" onClick={onRequestLogin}>
            Entrar / criar conta
          </button>
        </div>
      ) : (
        <div className="ranking-me">
          <span>
            Você: <strong>{user.displayName}</strong>
            {myScore !== null && ` — ${myScore} pts`}
            {myRank !== null && ` (#${myRank})`}
          </span>
          <button type="button" className="ranking-logout" onClick={onLogout}>
            Sair
          </button>
        </div>
      )}

      {error && <p className="auth-error">{error}</p>}

      {entries.length === 0 ? (
        <p className="ranking-empty">Ninguém no leaderboard ainda — resolva um desafio pra ser o primeiro.</p>
      ) : (
        <ol className="ranking-list">
          {entries.map((e) => (
            <li key={e.userId} className={e.userId === user?.id ? "ranking-row me" : "ranking-row"}>
              <span className="ranking-rank">#{e.rank}</span>
              <span className="ranking-name">{e.displayName}</span>
              <span className="ranking-score">{e.score} pts</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
