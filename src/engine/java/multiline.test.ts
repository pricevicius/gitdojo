import { describe, expect, it } from "vitest";
import { splitSnippets, runCommand } from "./commands";
import { createInitialJavaState } from "./types";

describe("splitSnippets", () => {
  it("classe indentada em várias linhas vira um trecho só", () => {
    const src = `class Ranger {
    String cor;

    void morfar() {
        System.out.println("Vai, " + this.cor + "!");
    }
}`;
    expect(splitSnippets(src)).toHaveLength(1);
  });

  it("separa declaração, atribuição e chamada", () => {
    const src = `Ranger r = new Ranger();
r.cor = "Vermelho";
r.morfar()`;
    expect(splitSnippets(src)).toEqual([
      'Ranger r = new Ranger();',
      'r.cor = "Vermelho";',
      'r.morfar()',
    ]);
  });

  it("não quebra dentro de parênteses de várias linhas", () => {
    const src = `System.out.println(
    "oi"
);`;
    expect(splitSnippets(src)).toHaveLength(1);
  });

  it("chamadas sem ponto e vírgula, uma por linha", () => {
    expect(splitSnippets("a.morfar()\nb.morfar()")).toEqual(["a.morfar()", "b.morfar()"]);
  });
});

describe("execução multi-linha", () => {
  it("roda a aula inteira de uma vez", () => {
    const src = `jshell
// o molde
class Ranger {
    private String cor;

    Ranger(String cor) {
        this.cor = cor;
    }

    void morfar() {
        System.out.println("Vai, " + this.cor + "!");
    }
}

Ranger r = new Ranger("Vermelho");
r.morfar()`;
    const result = runCommand(src, createInitialJavaState());
    expect(result.ok).toBe(true);
    expect(result.output).toContain("Vai, Vermelho!");
    expect(result.state.types.Ranger).toBeDefined();
    expect(result.unlockedCommands).toContain("jshell");
  });

  it("para no erro mas preserva o que já rodou", () => {
    const src = `jshell
class Ranger { String cor; }
Ranger r = new Ranger();
r.naoExiste()
r.cor = "tarde demais";`;
    const result = runCommand(src, createInitialJavaState());
    expect(result.ok).toBe(false);
    expect(result.state.types.Ranger).toBeDefined();
    expect(result.output.join(" ")).toContain("parou em");
  });
});

describe("erros típicos de quem está começando", () => {
  it("comando dentro do corpo da classe explica onde a linha deveria estar", () => {
    const src = `jshell
class Ranger {
    new Ranger();
}`;
    const result = runCommand(src, createInitialJavaState());
    expect(result.ok).toBe(false);
    const erro = result.output.join(" ");
    expect(erro).toContain("está dentro do corpo da classe Ranger");
    expect(erro).toContain("criar um objeto");
    expect(erro).toContain("depois do '}'");
    // O que NÃO pode mais aparecer: a mensagem que travava a pessoa.
    expect(erro).not.toContain("o método Ranger precisa de um corpo");
  });

  it("println solto dentro da classe também é diagnosticado", () => {
    const src = `jshell
class Ranger {
    System.out.println("oi");
}`;
    const result = runCommand(src, createInitialJavaState());
    expect(result.ok).toBe(false);
    expect(result.output.join(" ")).toContain("imprimir na tela");
  });

  it("chamada de método solta dentro da classe também", () => {
    const src = `jshell
class Ranger {
    String cor;
    r.morfar();
}`;
    const result = runCommand(src, createInitialJavaState());
    expect(result.ok).toBe(false);
    expect(result.output.join(" ")).toContain("chamar um método");
  });

  it("um campo de verdade continua sendo aceito", () => {
    const src = `jshell
class Ranger {
    String cor;
    int poder = 100;
}`;
    const result = runCommand(src, createInitialJavaState());
    expect(result.ok).toBe(true);
    expect(result.state.types.Ranger.fields).toHaveLength(2);
  });

  it("método com corpo continua sendo aceito", () => {
    const src = `jshell
class Ranger {
    String cor;

    void morfar() {
        System.out.println("Vai!");
    }
}`;
    const result = runCommand(src, createInitialJavaState());
    expect(result.ok).toBe(true);
    expect(result.state.types.Ranger.methods[0].name).toBe("morfar");
  });
});
