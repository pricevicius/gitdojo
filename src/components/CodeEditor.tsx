import { useRef, useState } from "react";

interface LogLine {
  kind: "input" | "output" | "error";
  text: string;
}

interface Props {
  solved: boolean;
  onRun: (source: string) => { ok: boolean; output: string[] };
  onNext: () => void;
  log: LogLine[];
  setLog: React.Dispatch<React.SetStateAction<LogLine[]>>;
  /** Linguagem destacada; hoje só "java". */
  language?: "java";
  /** Deixa quem está de fora focar o editor (o botão "Responder" do painel). */
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** Código de partida do desafio (ver ChallengeMeta.starter). */
  starter?: string;
}

/**
 * Editor de código para dojos onde o que se digita é código, e não um comando
 * curto de uma linha — ver `inputMode` em src/dojo/types.ts.
 *
 * É um textarea transparente sobre um <pre> colorido: a técnica clássica de
 * destaque de sintaxe sem dependência externa. O projeto não tem framework de
 * UI nem editor pronto (o bundle inteiro tem 366 kB), e trazer um Monaco ou
 * CodeMirror só para isto custaria mais que o resto da aplicação junta. As
 * duas camadas precisam ter exatamente a mesma métrica de texto, por isso
 * compartilham a classe .code-layer no CSS.
 */

const INDENT = "    ";

const JAVA_KEYWORDS = new Set([
  "class",
  "interface",
  "extends",
  "implements",
  "new",
  "private",
  "public",
  "protected",
  "static",
  "final",
  "abstract",
  "void",
  "return",
  "this",
  "super",
  "int",
  "boolean",
  "var",
  "true",
  "false",
  "null",
]);

type TokenKind = "comment" | "string" | "annotation" | "keyword" | "number" | "type" | "plain";

interface Token {
  text: string;
  kind: TokenKind;
}

const TOKEN_PATTERN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*")|(@\w+)|(\b\d+\b)|([A-Za-z_]\w*)/g;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(source)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: source.slice(lastIndex, match.index), kind: "plain" });
    }
    const [text, comment, str, annotation, num, word] = match;
    if (comment) tokens.push({ text, kind: "comment" });
    else if (str) tokens.push({ text, kind: "string" });
    else if (annotation) tokens.push({ text, kind: "annotation" });
    else if (num) tokens.push({ text, kind: "number" });
    else if (word) {
      const kind: TokenKind = JAVA_KEYWORDS.has(word)
        ? "keyword"
        : /^[A-Z]/.test(word)
          ? "type"
          : "plain";
      tokens.push({ text, kind });
    }
    lastIndex = match.index + text.length;
  }
  if (lastIndex < source.length) {
    tokens.push({ text: source.slice(lastIndex), kind: "plain" });
  }
  return tokens;
}

/** Indentação (só os espaços do começo) da linha onde o cursor está. */
function currentIndent(value: string, caret: number): string {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const line = value.slice(lineStart, caret);
  return line.match(/^[ \t]*/)?.[0] ?? "";
}

export default function CodeEditor({
  solved,
  onRun,
  onNext,
  log,
  setLog,
  language = "java",
  inputRef,
  starter = "",
}: Props) {
  // O App remonta este componente a cada desafio (key em App.tsx), então o
  // estado inicial é reavaliado e o editor não carrega o código do anterior.
  const [source, setSource] = useState(starter);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? internalRef;
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = source.split("\n").length;

  function syncScroll() {
    const ta = textareaRef.current;
    if (!ta) return;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop;
      highlightRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  }

  /** Substitui a seleção mantendo o cursor onde a pessoa espera. */
  function replaceSelection(text: string, caretOffset = text.length) {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd } = ta;
    const next = source.slice(0, selectionStart) + text + source.slice(selectionEnd);
    setSource(next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = selectionStart + caretOffset;
      syncScroll();
    });
  }

  function handleRun() {
    if (!source.trim()) return;
    const result = onRun(source);
    setLog((prev) => [
      ...prev,
      ...source
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map((l) => ({ kind: "input", text: l } as LogLine)),
      ...result.output
        .filter((l) => l.length > 0)
        .map((l) => ({ kind: result.ok ? "output" : "error", text: l } as LogLine)),
    ]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;

    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleRun();
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: tira um nível de indentação do começo da linha.
        const lineStart = source.lastIndexOf("\n", ta.selectionStart - 1) + 1;
        if (source.slice(lineStart, lineStart + INDENT.length) === INDENT) {
          const next = source.slice(0, lineStart) + source.slice(lineStart + INDENT.length);
          const caret = Math.max(lineStart, ta.selectionStart - INDENT.length);
          setSource(next);
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = caret;
          });
        }
      } else {
        replaceSelection(INDENT);
      }
      return;
    }

    if (e.key === "Enter") {
      // Auto-indent: mantém a indentação da linha e entra um nível depois de '{'.
      e.preventDefault();
      const caret = ta.selectionStart;
      const indent = currentIndent(source, caret);
      const before = source.slice(0, caret).trimEnd();
      const abreBloco = before.endsWith("{");
      const novoIndent = abreBloco ? indent + INDENT : indent;
      const fechaDepois = source.slice(ta.selectionEnd).trimStart().startsWith("}");

      if (abreBloco && fechaDepois) {
        // Cursor numa linha nova indentada, com o '}' descendo uma linha.
        replaceSelection(`\n${novoIndent}\n${indent}`, 1 + novoIndent.length);
      } else {
        replaceSelection(`\n${novoIndent}`);
      }
      return;
    }

    if (e.key === "}") {
      // Digitar '}' numa linha só de espaços tira um nível, como num editor.
      const lineStart = source.lastIndexOf("\n", ta.selectionStart - 1) + 1;
      const linhaAteCursor = source.slice(lineStart, ta.selectionStart);
      if (/^[ ]+$/.test(linhaAteCursor) && linhaAteCursor.length >= INDENT.length) {
        e.preventDefault();
        const next =
          source.slice(0, ta.selectionStart - INDENT.length) + "}" + source.slice(ta.selectionEnd);
        const caret = ta.selectionStart - INDENT.length + 1;
        setSource(next);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = caret;
        });
      }
    }
  }

  const tokens = tokenize(source);

  return (
    <div className="code-editor">
      <div className="code-editor-shell">
        <div className="code-editor-toolbar">
          <span className="code-editor-filename">Rascunho.{language}</span>
          <span className="code-editor-shortcut">
            <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Enter</kbd> executa
          </span>
        </div>

        <div className="code-editor-body">
          <div className="code-gutter" ref={gutterRef} aria-hidden="true">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} className="code-gutter-line">
                {i + 1}
              </div>
            ))}
          </div>

          <div className="code-input-wrap">
            <pre className="code-layer code-highlight" ref={highlightRef} aria-hidden="true">
              {source.length === 0 ? (
                <span className="code-placeholder">
                  Escreva seu Java aqui e clique em Executar…
                </span>
              ) : (
                <>
                  {tokens.map((t, i) => (
                    <span key={i} className={`tok-${t.kind}`}>
                      {t.text}
                    </span>
                  ))}
                  {/* Uma linha em branco no fim não conta no <pre>; este
                      caractere mantém as duas camadas com a mesma altura. */}
                  {source.endsWith("\n") ? "\u200b" : null}
                </>
              )}
            </pre>
            <textarea
              ref={textareaRef}
              className="code-layer code-input"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              onKeyDown={handleKeyDown}
              onScroll={syncScroll}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="Editor de código"
            />
          </div>
        </div>

        <div className="code-editor-actions">
          {solved ? (
            <div className="code-editor-solved">
              <span>✅ Resolvido!</span>
              <button type="button" className="btn-primary" onClick={onNext}>
                Próximo desafio →
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="btn-primary"
                onClick={handleRun}
                disabled={!source.trim()}
              >
                ▶ Executar
              </button>
              <button
                type="button"
                className="code-editor-clear"
                onClick={() => setSource(starter)}
                disabled={source === starter}
              >
                {starter ? "Recomeçar" : "Limpar"}
              </button>
            </>
          )}
        </div>
      </div>

      {log.length > 0 && (
        <div className="code-editor-output">
          <span className="code-editor-output-title">Saída</span>
          <div className="terminal-log">
            {log.slice(-12).map((line, i) => (
              <div key={i} className={`terminal-line terminal-${line.kind}`}>
                {line.kind === "input" ? <span className="prompt">›</span> : null}
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
