import { DICTIONARY, CATEGORIES } from "../data/dictionary";

interface Props {
  unlocked: Set<string>;
}

export default function Dictionary({ unlocked }: Props) {
  return (
    <div className="dictionary">
      <h2>📖 Seu dicionário</h2>
      <p className="dictionary-sub">
        {unlocked.size} de {Object.keys(DICTIONARY).length} comandos aprendidos
      </p>
      {CATEGORIES.map((cat) => {
        const entries = Object.entries(DICTIONARY).filter(([, e]) => e.category === cat);
        return (
          <div key={cat} className="dictionary-category">
            <h3>{cat}</h3>
            <div className="dictionary-grid">
              {entries.map(([key, entry]) => {
                const isUnlocked = unlocked.has(key);
                return (
                  <div
                    key={key}
                    className={isUnlocked ? "dict-card unlocked" : "dict-card locked"}
                  >
                    {isUnlocked ? (
                      <>
                        <div className="dict-card-title">{entry.command}</div>
                        <div className="dict-card-short">{entry.short}</div>
                        <code className="dict-card-example">{entry.example}</code>
                      </>
                    ) : (
                      <div className="dict-card-locked-label">🔒 ???</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
