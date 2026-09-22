import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import CodeEditor from "./CodeEditor";

const noop = () => {};
const runStub = () => ({ ok: true, output: [] });

describe("CodeEditor", () => {
  it("renderiza vazio, com o convite para escrever", () => {
    const html = renderToString(
      <CodeEditor solved={false} onRun={runStub} onNext={noop} log={[]} setLog={noop} />
    );
    expect(html).toContain("Escreva seu Java aqui");
    expect(html).toContain("Executar");
  });

  it("mostra a saída acumulada quando já houve execução", () => {
    const log = [
      { kind: "input" as const, text: "r.morfar()" },
      { kind: "output" as const, text: "Vai, Vermelho!" },
    ];
    const html = renderToString(
      <CodeEditor solved={false} onRun={runStub} onNext={noop} log={log} setLog={noop} />
    );
    expect(html).toContain("Vai, Vermelho!");
    expect(html).toContain("Saída");
  });

  it("troca as ações pelo avanço quando o desafio está resolvido", () => {
    const html = renderToString(
      <CodeEditor solved onRun={runStub} onNext={noop} log={[]} setLog={noop} />
    );
    expect(html).toContain("Resolvido");
    expect(html).toContain("Próximo desafio");
    // O botão some, mas a palavra "Executar" segue no texto do placeholder —
    // daí a checagem ser pelo botão e não pela palavra.
    expect(html).not.toContain("▶ Executar");
    expect(html).not.toContain("code-editor-clear");
  });

  it("não repete o enunciado, que já aparece no painel do desafio", () => {
    const html = renderToString(
      <CodeEditor solved={false} onRun={runStub} onNext={noop} log={[]} setLog={noop} />
    );
    expect(html).not.toContain("code-editor-challenge");
  });

  it("numera as linhas e não chama onRun sozinho", () => {
    const onRun = vi.fn(runStub);
    const html = renderToString(
      <CodeEditor solved={false} onRun={onRun} onNext={noop} log={[]} setLog={noop} />
    );
    expect(html).toContain("code-gutter-line");
    expect(onRun).not.toHaveBeenCalled();
  });
});
