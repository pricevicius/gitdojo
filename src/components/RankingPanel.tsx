import { useEffect, useState } from "react";
import {
  ApiError,
  getLeaderboard,
  getMyStats,
  isRankingEnabled,
  type AuthUser,
  type LeaderboardEntry,
} from "../api/client";

interface Props {
  domain: string;
  user: AuthUser | null;
  onRequestLogin: () => void;
  onLogout: () => void;
  /** Incrementado toda vez que um desafio é resolvido, pra recarregar o leaderboard. */
  refreshToken: number;
}

export default function RankingPanel({ domain, user, onRequestLogin, onLogout, refreshToken }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRankingEnabled()) return;
    let cancelled = false;

    getLeaderboard(domain)
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "falha ao carregar ranking");
      });

    if (user) {
      getMyStats(domain)
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
  }, [domain, user, refreshToken]);

  if (!isRankingEnabled()) {
    return (
      <div className="ranking-panel">
        <h2>🏆 Ranking</h2>
        <p className="ranking-empty">Ranking indisponível nesta instância (sem backend configurado).</p>
      </div>
    );
  }

  return (
    <div className="ranking-panel">
      <h2>🏆 Ranking</h2>

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
