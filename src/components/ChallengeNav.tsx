import type { Challenge } from "../data/challenges";

interface Props {
  challenges: Challenge[];
  trilhasOrder: readonly string[];
  currentId: string;
  solvedIds: Set<string>;
  onSelect: (index: number) => void;
}

export default function ChallengeNav({
  challenges,
  trilhasOrder,
  currentId,
  solvedIds,
  onSelect,
}: Props) {
  return (
    <nav className="challenge-nav">
      {trilhasOrder.map((trilha) => {
        const items = challenges
          .map((c, index) => ({ c, index }))
          .filter(({ c }) => c.trilha === trilha);
        if (items.length === 0) return null;
        return (
          <div key={trilha} className="challenge-nav-trilha">
            <span className="challenge-nav-trilha-label">{trilha}</span>
            <div className="challenge-nav-pills">
              {items.map(({ c, index }) => {
                const isCurrent = c.id === currentId;
                const isSolved = solvedIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.title}
                    className={
                      "challenge-nav-pill" +
                      (isCurrent ? " current" : "") +
                      (isSolved ? " solved" : "")
                    }
                    onClick={() => onSelect(index)}
                  >
                    {isSolved ? "✓" : index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
