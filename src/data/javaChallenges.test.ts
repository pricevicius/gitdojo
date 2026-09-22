import { describe, it, expect } from "vitest";
import { JAVA_CHALLENGES } from "./javaChallenges";
import { runCommand } from "../engine/java/commands";
import type { JavaState } from "../engine/java/types";

/**
 * Uma solução de referência por desafio. Além de provar que cada desafio é
 * resolúvel, isto é a rede que segura a aula: se alguém mexer no parser e a
 * sintaxe ensinada no enunciado parar de funcionar, o teste aponta qual
 * desafio ficou impossível — o pior defeito possível num material de ensino.
 */
const SOLUCOES: Record<string, string[]> = {
  "jshell-1": ["jshell"],
  "classe-1": ["class Ranger { }"],
  "campo-1": ["class Ranger { String cor; }"],
  "new-1": ["Ranger r = new Ranger();"],
  "campo-valor-1": ['r.cor = "Vermelho";'],
  "dois-objetos-1": ["Ranger a = new Ranger();", 'a.cor = "Azul";'],
  "metodo-1": [
    'class Ranger { String cor; void morfar() { System.out.println("Vai, " + this.cor + "!"); } }',
    "Ranger r = new Ranger();",
    'r.cor = "Vermelho";',
    "r.morfar()",
  ],
  "private-1": ["class Ranger { private String cor; }"],
  "construtor-1": [
    "class Ranger { private String cor; Ranger(String cor) { this.cor = cor; } }",
    'Ranger r = new Ranger("Vermelho");',
  ],
  "getter-1": [
    "class Ranger { private String cor; Ranger(String cor) { this.cor = cor; } String getCor() { return this.cor; } }",
    'Ranger r = new Ranger("Vermelho");',
    "r.getCor()",
  ],
  "extends-1": ["class RangerVerde extends Ranger { }"],
  "super-1": [
    'class RangerVerde extends Ranger { RangerVerde() { super("Verde"); } }',
    "RangerVerde v = new RangerVerde();",
  ],
  "override-1": [
    'class RangerVerde extends Ranger { @Override void morfar() { System.out.println("Flauta do Dragao!"); } }',
    "RangerVerde v = new RangerVerde();",
    "v.morfar()",
  ],
  "interface-1": ["interface Morfavel { void morfar(); }"],
  "implements-1": [
    'class RangerVermelho implements Morfavel { public void morfar() { System.out.println("Tiranossauro!"); } }',
    "RangerVermelho r = new RangerVermelho();",
    "r.morfar()",
  ],
  "polimorfismo-1": [
    'class RangerPreto implements Morfavel { public void morfar() { System.out.println("Mastodonte!"); } }',
    "Morfavel a = new RangerVermelho();",
    "Morfavel b = new RangerPreto();",
    "a.morfar()",
    "b.morfar()",
  ],
  "types-1": ["/types"],
  "vars-1": ["/vars"],
};

describe("desafios Java OOP", () => {
  it.each(JAVA_CHALLENGES.map((c) => [c.id, c] as const))(
    "%s começa não resolvido (goal(setup()) é false)",
    (_id, challenge) => {
      expect(challenge.goal(challenge.setup())).toBe(false);
    }
  );

  it("todos os ids são únicos", () => {
    const ids = JAVA_CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo desafio tem uma solução de referência", () => {
    for (const challenge of JAVA_CHALLENGES) {
      expect(SOLUCOES[challenge.id], `falta solução para ${challenge.id}`).toBeDefined();
    }
  });

  it.each(JAVA_CHALLENGES.map((c) => [c.id, c] as const))(
    "%s é resolvido pela solução de referência",
    (id, challenge) => {
      let state: JavaState = challenge.setup();
      for (const linha of SOLUCOES[id]) {
        const result = runCommand(linha, state);
        expect(result.ok, `'${linha}' falhou: ${result.output.join(" ")}`).toBe(true);
        state = result.state;
      }
      expect(challenge.goal(state)).toBe(true);
    }
  );
});

describe("código de partida (starter)", () => {
  const comStarter = JAVA_CHALLENGES.filter((c) => c.starter);

  it("os desafios que mais dependem de estrutura têm esqueleto", () => {
    expect(comStarter.length).toBeGreaterThanOrEqual(13);
  });

  it.each(comStarter.map((c) => [c.id, c] as const))(
    "%s: rodar só o esqueleto dá uma resposta útil, nunca silêncio",
    (_id, challenge) => {
      const result = runCommand(challenge.starter!, challenge.setup());
      expect(result.output.join("").trim().length).toBeGreaterThan(0);
    }
  );

  it.each(comStarter.map((c) => [c.id, c] as const))(
    "%s: o esqueleto não resolve o desafio sozinho",
    (_id, challenge) => {
      const result = runCommand(challenge.starter!, challenge.setup());
      expect(challenge.goal(result.state)).toBe(false);
    }
  );

  it("nenhum esqueleto entrega a resposta com código pronto fora de comentário", () => {
    for (const challenge of comStarter) {
      const semComentarios = challenge
        .starter!.split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n");
      // O que sobra é só estrutura (chaves, campos já dados), nunca a linha
      // que o desafio pede — senão o exercício se resolve sozinho.
      expect(challenge.goal(runCommand(semComentarios, challenge.setup()).state)).toBe(false);
    }
  });
});
