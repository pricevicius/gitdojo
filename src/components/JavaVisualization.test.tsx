import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import JavaVisualization from "./JavaVisualization";
import { runCommand } from "../engine/java/commands";
import { createInitialJavaState } from "../engine/java/types";
import type { JavaState } from "../engine/java/types";
import { JAVA_CHALLENGES } from "../data/javaChallenges";

/**
 * O build e os testes do motor não pegariam um erro de render. Como a
 * visualização lê estruturas que só existem depois de alguns comandos
 * (heap, herança, campo apontando para outro objeto), vale renderizar de
 * verdade os estados que a pessoa realmente vai produzir.
 */
function build(...lines: string[]): JavaState {
  let state = createInitialJavaState();
  for (const line of lines) {
    state = runCommand(line, state).state;
  }
  return state;
}

describe("JavaVisualization", () => {
  it("renderiza o estado inicial, antes do jshell abrir", () => {
    const html = renderToString(<JavaVisualization state={createInitialJavaState()} />);
    expect(html).toContain("jshell ainda não foi aberto");
  });

  it("renderiza a sessão vazia sem quebrar", () => {
    const html = renderToString(<JavaVisualization state={build("jshell")} />);
    expect(html).toContain("Tipos declarados");
    expect(html).toContain("Nenhuma classe ainda");
  });

  it("mostra classe, campo private e objeto com valores", () => {
    const state = build(
      "jshell",
      "class Ranger { private String cor; Ranger(String cor) { this.cor = cor; } }",
      'Ranger r = new Ranger("Vermelho");'
    );
    const html = renderToString(<JavaVisualization state={state} />);
    expect(html).toContain("Ranger");
    expect(html).toContain("cor");
    expect(html).toContain("Vermelho");
  });

  it("mostra a herança e o @Override na hierarquia", () => {
    const state = build(
      "jshell",
      'class Ranger { String cor; void morfar() { System.out.println("Vai!"); } }',
      'class RangerVerde extends Ranger { @Override void morfar() { System.out.println("Flauta!"); } }'
    );
    const html = renderToString(<JavaVisualization state={state} />);
    expect(html).toContain("extends");
    expect(html).toContain("@Override");
  });

  it("marca a variável cujo tipo declarado difere da classe do objeto", () => {
    const state = build(
      "jshell",
      "interface Morfavel { void morfar(); }",
      'class RangerPreto implements Morfavel { public void morfar() { System.out.println("Mastodonte!"); } }',
      "Morfavel m = new RangerPreto();",
      "m.morfar()"
    );
    const html = renderToString(<JavaVisualization state={state} />);
    // O React separa nós de texto vizinhos com um comentário, então o selo sai
    // como "guarda um <!-- -->RangerPreto" — daí a checagem em duas partes.
    expect(html).toContain("java-object-actual");
    expect(html).toContain("guarda um ");
    expect(html).toContain("RangerPreto</span>");
    expect(html).toContain("Mastodonte!");
  });

  it("renderiza o estado de partida de todo desafio da trilha", () => {
    for (const challenge of JAVA_CHALLENGES) {
      expect(
        () => renderToString(<JavaVisualization state={challenge.setup()} />),
        `desafio ${challenge.id} quebrou a visualização`
      ).not.toThrow();
    }
  });
});
