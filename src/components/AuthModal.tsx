import { useState } from "react";
import { ApiError, login, register, type AuthUser } from "../api/client";

interface Props {
  onClose: () => void;
  onAuthed: (user: AuthUser) => void;
}

export default function AuthModal({ onClose, onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user =
        mode === "login" ? await login(email, password) : await register(email, password, displayName);
      onAuthed(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "algo deu errado, tenta de novo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="spotlight-backdrop" onClick={onClose}>
      <div className="spotlight-modal auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="spotlight-challenge">
          <span className="spotlight-challenge-trilha">Ranking</span>
          <h3>{mode === "login" ? "Entrar" : "Criar conta"}</h3>
          <p>Entre pra aparecer no leaderboard e acompanhar seu progresso entre dispositivos.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <input
              type="text"
              placeholder="Nome de exibição"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="senha (mínimo 8 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode((m) => (m === "login" ? "register" : "login"));
            setError(null);
          }}
        >
          {mode === "login" ? "Não tem conta? Criar uma" : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}
