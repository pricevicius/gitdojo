import { useState } from "react";
import type { DictionaryEntry } from "../dojo/types";

interface Props {
  dictionary: Record<string, DictionaryEntry>;
  categories: readonly string[];
  unlocked: Set<string>;
  currentTrilha: string;
}

export default function Dictionary({ dictionary, categories, unlocked, currentTrilha }: Props) {
  // Categorias abertas por padrão são só a da trilha atual; um clique
  // "alterna" (toggled) essa categoria em relação ao padrão dela.
  const [toggled, setToggled] = useState<Set<string>>(new Set());

  function isCategoryOpen(cat: string): boolean {
    const openByDefault = cat === currentTrilha;
    return toggled.has(cat) ? !openByDefault : openByDefault;
  }

  function toggleCategory(cat: string) {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <div className="dictionary">
      <h2>📖 Seu dicionário</h2>
      <p className="dictionary-sub">
        {unlocked.size} de {Object.keys(dictionary).length} comandos aprendidos
      </p>
      {categories.map((cat) => {
        const entries = Object.entries(dictionary).filter(([, e]) => e.category === cat);
        const unlockedCount = entries.filter(([key]) => unlocked.has(key)).length;
        const isOpen = isCategoryOpen(cat);
        return (
          <div key={cat} className="dictionary-category">
            <button
              type="button"
              className="dictionary-category-header"
              onClick={() => toggleCategory(cat)}
            >
              <span>{cat}</span>
              <span className="dictionary-category-meta">
                {unlockedCount}/{entries.length}
                <span className={`dictionary-chevron${isOpen ? " open" : ""}`}>▸</span>
              </span>
            </button>
            {isOpen && (
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
            )}
          </div>
        );
      })}
    </div>
  );
}
