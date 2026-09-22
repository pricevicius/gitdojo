import { describe, expect, it } from "vitest";
import { runCommand } from "./commands";
import { createInitialJavaState } from "./types";
import type { JavaState } from "./types";

/**
 * Calibração para quem nunca programou: numa trilha de ensino, a mensagem de
 * erro É conteúdo. Cada caso aqui é um tropeço real de iniciante, e o que se
 * verifica não é só que dá erro, mas que a mensagem DIZ O QUE FAZER — uma
 * mensagem tecnicamente correta e incompreensível deixa a pessoa travada, que
 * é o pior desfecho possível.
 */
function aberto(): JavaState {
  return runCommand("jshell", createInitialJavaState()).state;
}

function erroDe(src: string, from: JavaState = aberto()): string {
  const result = runCommand(src, from);
  expect(result.ok, `esperava erro em:\n${src}`).toBe(false);
  return result.output.join(" ");
}

describe("mensagens para quem está começando", () => {
  it("comando solto dentro da classe diz onde a linha deveria estar", () => {
    const erro = erroDe("class Ranger {\n    new Ranger();\n}");
    expect(erro).toContain("O corpo de uma classe só declara");
    expect(erro).toContain("depois do '}'");
  });

  it("campo sem ponto e vírgula é recusado, e não aceito em silêncio", () => {
    const erro = erroDe("class Ranger {\n    String cor\n}");
    expect(erro).toContain("faltou o ponto e vírgula");
  });

  it("palavra-chave com maiúscula errada explica a diferença de caixa", () => {
    const erro = erroDe("Class Ranger { }");
    expect(erro).toContain("caixa errada");
    expect(erro).toContain("'class'");
  });

  it("o main copiado de tutorial é explicado, não rejeitado como lixo", () => {
    const erro = erroDe('public static void main(String[] args) {\n    System.out.println("oi");\n}');
    expect(erro).toContain("não precisa de 'public static void main'");
  });

  it("esquecer o new diz exatamente o que escrever", () => {
    const erro = erroDe("class Ranger { }\nRanger r = Ranger();");
    expect(erro).toContain("faltou a palavra 'new'");
    expect(erro).toContain("new Ranger()");
  });

  it("aspas simples em texto explica a regra das aspas duplas", () => {
    const erro = erroDe("class Ranger { String cor; }\nRanger r = new Ranger();\nr.cor = 'Vermelho';");
    expect(erro).toContain("aspas DUPLAS");
  });

  it("método inexistente lista os métodos que a classe realmente tem", () => {
    const erro = erroDe(
      "class Ranger { void morfar() { } void lutar() { } }\nRanger r = new Ranger();\nr.voar()"
    );
    expect(erro).toContain("não tem um método chamado voar()");
    expect(erro).toContain("morfar(), lutar()");
  });

  it("print sem ln aponta o 'ln' que faltou", () => {
    const erro = erroDe('System.out.print("oi")');
    expect(erro).toContain("'print' sem o 'ln'");
  });

  it("só comentários responde algo, em vez de silêncio", () => {
    const erro = erroDe("// ainda nao escrevi nada\n");
    expect(erro).toContain("só tem comentário");
  });

  it("campo private lido de fora sugere o getter", () => {
    const erro = erroDe(
      'class Ranger { private String cor; Ranger(String cor) { this.cor = cor; } }\nRanger r = new Ranger("Vermelho");\nr.cor'
    );
    expect(erro).toContain("private access");
    expect(erro).toContain("getter");
  });

  it("usar o nome da classe como objeto explica a diferença", () => {
    const erro = erroDe("class Ranger { String cor; }\nRanger.cor");
    expect(erro).toContain("não de um objeto");
  });

  it("interface não pode virar objeto, e a mensagem diz o que fazer", () => {
    const erro = erroDe("interface Morfavel { void morfar(); }\nMorfavel m = new Morfavel();");
    expect(erro).toContain("Crie um objeto de uma classe que a implementa");
  });
});
