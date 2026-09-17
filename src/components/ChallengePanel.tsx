import type { Challenge } from "../data/challenges";

interface Props {
  challenge: Challenge;
  index: number;
  total: number;
  solved: boolean;
  showHint: boolean;
  onToggleHint: () => void;
  onNext: () => void;
  onReset: () => void;
}

export default function ChallengePanel({
  challenge,
  index,
  total,
  solved,
  showHint,
  onToggleHint,
  onNext,
  onReset,
}: Props) {
  return (
    <div className="challenge-panel">
      <div className="challenge-meta">
        <span className="challenge-trilha">{challenge.trilha}</span>
        <span className="challenge-progress">
          {index + 1} / {total}
        </span>
      </div>
      <h2>{challenge.title}</h2>
      <p>{challenge.description}</p>

      <div className="challenge-actions">
        <button className="btn-secondary" onClick={onToggleHint}>
          {showHint ? "Esconder dica" : "Ver dica"}
        </button>
        <button className="btn-secondary" onClick={onReset}>
          Reiniciar desafio
        </button>
      </div>

      {showHint && <div className="challenge-hint">💡 {challenge.hint}</div>}

      {solved && (
        <div className="challenge-solved">
          <span>✅ Resolvido!</span>
          <button className="btn-primary" onClick={onNext}>
            Próximo desafio →
          </button>
        </div>
      )}
    </div>
  );
}
