import { useState, useRef, useEffect } from "react";

interface LogLine {
  kind: "input" | "output" | "error";
  text: string;
}

interface Props {
  onRun: (command: string) => { ok: boolean; output: string[] };
  log: LogLine[];
  setLog: React.Dispatch<React.SetStateAction<LogLine[]>>;
}

export default function Terminal({ onRun, log, setLog }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const history = log.filter((l) => l.kind === "input").map((l) => l.text);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log, isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    function onGlobalKeyDown(e: KeyboardEvent) {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const isSlash = e.key === "/" && !isOpen;
      if (isShortcut || isSlash) {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [isOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const result = onRun(input);
    setLog((prev) => [
      ...prev,
      { kind: "input", text: input },
      ...result.output
        .filter((l) => l.length > 0)
        .map((l) => ({ kind: result.ok ? "output" : "error", text: l } as LogLine)),
    ]);
    setInput("");
    setHistoryIndex(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === null) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setInput("");
      } else {
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      }
    }
  }

  const recentLog = log.slice(-8);

  return (
    <div className="terminal">
      <div className="terminal-log">
        {log.map((line, i) => (
          <div key={i} className={`terminal-line terminal-${line.kind}`}>
            {line.kind === "input" ? <span className="prompt">$</span> : null}
            {line.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <button
        type="button"
        className="terminal-trigger"
        onClick={() => setIsOpen(true)}
      >
        <span className="prompt">$</span>
        <span className="terminal-trigger-placeholder">digite um comando git...</span>
        <kbd>/</kbd>
      </button>

      {isOpen && (
        <div className="spotlight-backdrop" onClick={() => setIsOpen(false)}>
          <div className="spotlight-modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit} className="spotlight-input-row">
              <span className="prompt">$</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setHistoryIndex(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="digite um comando git..."
                spellCheck={false}
                autoComplete="off"
              />
              <kbd>esc</kbd>
            </form>
            {recentLog.length > 0 && (
              <div className="spotlight-results">
                {recentLog.map((line, i) => (
                  <div key={i} className={`terminal-line terminal-${line.kind}`}>
                    {line.kind === "input" ? <span className="prompt">$</span> : null}
                    {line.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
