import { describe, expect, it } from "vitest";
import { runCommand } from "./commands";
import { createInitialJavaState } from "./types";
import type { JavaState } from "./types";

/** Roda uma sequência de linhas, devolvendo o estado e a saída da última. */
function run(lines: string[], from?: JavaState) {
  let state = from ?? createInitialJavaState();
  let output: string[] = [];
  let ok = true;
  for (const line of lines) {
    const result = runCommand(line, state);
    state = result.state;
    output = result.output;
    ok = result.ok;
  }
  return { state, output, ok };
}

/** Sessão com o jshell já aberto — ponto de partida da maioria dos testes. */
function started(): JavaState {
  return run(["jshell"]).state;
}

const RANGER = 'class Ranger { String cor; void morfar() { System.out.println("Vai, " + this.cor + "!"); } }';

describe("shell (antes do jshell abrir)", () => {
  it("recusa comando que não seja jshell", () => {
    const { ok, output } = run(["git status"]);
    expect(ok).toBe(false);
    expect(output.join(" ")).toContain("jshell");
  });

  it("abre o REPL com 'jshell'", () => {
    const { state, ok } = run(["jshell"]);
    expect(ok).toBe(true);
    expect(state.jshellStarted).toBe(true);
  });

  it("responde 'java --version'", () => {
    const { ok, output } = run(["java --version"]);
    expect(ok).toBe(true);
    expect(output[0]).toContain("openjdk");
  });

  it("'/exit' fecha o REPL e volta pro shell", () => {
    const { state } = run(["jshell", "/exit"], createInitialJavaState());
    expect(state.jshellStarted).toBe(false);
  });
});

describe("classe e objeto", () => {
  it("declara uma classe com campo", () => {
    const { state, output } = run([RANGER], started());
    expect(output[0]).toBe("|  created class Ranger");
    expect(state.types.Ranger.fields).toHaveLength(1);
    expect(state.types.Ranger.fields[0]).toMatchObject({ name: "cor", type: "String" });
    expect(state.types.Ranger.methods[0].name).toBe("morfar");
  });

  it("cria um objeto e guarda numa variável", () => {
    const { state, output } = run([RANGER, "Ranger r = new Ranger();"], started());
    expect(output[0]).toMatch(/^r ==> Ranger@/);
    expect(state.vars.r.declaredType).toBe("Ranger");
    expect(Object.keys(state.heap)).toHaveLength(1);
  });

  it("campo sem valor começa em null", () => {
    const { output } = run([RANGER, "Ranger r = new Ranger();", "r.cor"], started());
    expect(output[0]).toBe("$1 ==> null");
  });

  it("atribui um campo público de fora e lê de volta", () => {
    const { output } = run(
      [RANGER, "Ranger r = new Ranger();", 'r.cor = "Vermelho";', "r.cor"],
      started()
    );
    expect(output[0]).toBe('$1 ==> "Vermelho"');
  });

  it("chama um método void e imprime, sem produzir $n", () => {
    const { output } = run(
      [RANGER, "Ranger r = new Ranger();", 'r.cor = "Vermelho";', "r.morfar()"],
      started()
    );
    expect(output).toEqual(["Vai, Vermelho!"]);
  });

  it("dois objetos da mesma classe têm estado independente", () => {
    const { state } = run(
      [
        RANGER,
        "Ranger a = new Ranger();",
        "Ranger b = new Ranger();",
        'a.cor = "Vermelho";',
        'b.cor = "Azul";',
      ],
      started()
    );
    const ids = Object.keys(state.heap);
    expect(state.heap[ids[0]].fields.cor).toEqual({ kind: "string", value: "Vermelho" });
    expect(state.heap[ids[1]].fields.cor).toEqual({ kind: "string", value: "Azul" });
  });

  it("erra ao usar uma classe que não existe", () => {
    const { ok, output } = run(["Zord z = new Zord();"], started());
    expect(ok).toBe(false);
    expect(output.join(" ")).toContain("cannot find symbol");
  });

  it("erra ao usar o nome da classe como se fosse objeto", () => {
    const { ok, output } = run([RANGER, "Ranger.morfar()"], started());
    expect(ok).toBe(false);
    expect(output.join(" ")).toContain("não de um objeto");
  });
});

describe("encapsulamento", () => {
  const ENCAPSULADO =
    'class Ranger { private String cor; Ranger(String cor) { this.cor = cor; } String getCor() { return this.cor; } }';

  it("construtor recebe argumento e preenche o campo", () => {
    const { output } = run([ENCAPSULADO, 'Ranger r = new Ranger("Vermelho");', "r.getCor()"], started());
    expect(output[0]).toBe('$1 ==> "Vermelho"');
  });

  it("bloqueia leitura de campo private vinda de fora", () => {
    const { ok, output } = run([ENCAPSULADO, 'Ranger r = new Ranger("Vermelho");', "r.cor"], started());
    expect(ok).toBe(false);
    expect(output.join(" ")).toContain("has private access in Ranger");
  });

  it("bloqueia escrita em campo private vinda de fora", () => {
    const { ok, output } = run([ENCAPSULADO, 'Ranger r = new Ranger("Vermelho");', 'r.cor = "Azul";'], started());
    expect(ok).toBe(false);
    expect(output.join(" ")).toContain("has private access in Ranger");
  });

  it("cobra a quantidade certa de argumentos no construtor", () => {
    const { ok, output } = run([ENCAPSULADO, "Ranger r = new Ranger();"], started());
    expect(ok).toBe(false);
    expect(output.join(" ")).toContain("cannot be applied to given types");
  });

  it("campo com inicializador já nasce preenchido", () => {
    const { output } = run(
      ["class Zord { int poder = 100; }", "Zord z = new Zord();", "z.poder"],
      started()
    );
    expect(output[0]).toBe("$1 ==> 100");
  });
});

describe("herança", () => {
  const BASE = 'class Ranger { String cor; Ranger(String cor) { this.cor = cor; } void morfar() { System.out.println("Morfando de " + this.cor); } }';
  const VERMELHO = 'class RangerVermelho extends Ranger { RangerVermelho() { super("Vermelho"); } }';

  it("a filha herda campo e método da mãe", () => {
    const { output } = run([BASE, VERMELHO, "RangerVermelho r = new RangerVermelho();", "r.morfar()"], started());
    expect(output).toEqual(["Morfando de Vermelho"]);
  });

  it("recusa estender uma classe que ainda não existe", () => {
    const { ok, output } = run(["class RangerVermelho extends Ranger { }"], started());
    expect(ok).toBe(false);
    expect(output.join(" ")).toContain("cannot find symbol");
  });

  it("o método sobrescrito na filha vence o da mãe", () => {
    const { output } = run(
      [
        BASE,
        'class RangerVerde extends Ranger { RangerVerde() { super("Verde"); } @Override void morfar() { System.out.println("Flauta do Dragao!"); } }',
        "RangerVerde r = new RangerVerde();",
        "r.morfar()",
      ],
      started()
    );
    expect(output).toEqual(["Flauta do Dragao!"]);
  });

  it("super.metodo() chama a versão da mãe de dentro da filha", () => {
    const { output } = run(
      [
        BASE,
        'class RangerVerde extends Ranger { RangerVerde() { super("Verde"); } @Override void morfar() { super.morfar(); System.out.println("...e a flauta!"); } }',
        "RangerVerde r = new RangerVerde();",
        "r.morfar()",
      ],
      started()
    );
    expect(output).toEqual(["Morfando de Verde", "...e a flauta!"]);
  });

  it("cobra super(...) quando a mãe exige argumentos", () => {
    const { ok, output } = run([BASE, "class RangerAzul extends Ranger { RangerAzul() { } }", "RangerAzul r = new RangerAzul();"], started());
    expect(ok).toBe(false);
    expect(output.join(" ")).toContain("super");
  });
});

describe("polimorfismo e interface", () => {
  const MORFAVEL = "interface Morfavel { void morfar(); }";

  it("declara uma interface", () => {
    const { state, output } = run([MORFAVEL], started());
    expect(output[0]).toBe("|  created interface Morfavel");
    expect(state.types.Morfavel.kind).toBe("interface");
    expect(state.types.Morfavel.methods[0].abstract).toBe(true);
  });

  it("não deixa instanciar uma interface", () => {
    const { ok, output } = run([MORFAVEL, "Morfavel m = new Morfavel();"], started());
    expect(ok).toBe(false);
    expect(output.join(" ")).toContain("cannot be instantiated");
  });

  it("avisa quando a classe implementa mas não escreve o método", () => {
    const { output } = run([MORFAVEL, "class Ranger implements Morfavel { }"], started());
    expect(output.join(" ")).toContain("ainda não escreveu");
  });

  it("uma variável do tipo da interface aceita a classe que a implementa", () => {
    const { output } = run(
      [
        MORFAVEL,
        'class Ranger implements Morfavel { public void morfar() { System.out.println("Vai!"); } }',
        "Morfavel m = new Ranger();",
        "m.morfar()",
      ],
      started()
    );
    expect(output).toEqual(["Vai!"]);
  });

  it("recusa atribuir um objeto que não é do tipo declarado", () => {
    const { ok, output } = run(
      [MORFAVEL, "class Zord { }", "Morfavel m = new Zord();"],
      started()
    );
    expect(ok).toBe(false);
    expect(output.join(" ")).toContain("incompatible types");
  });

  it("a mesma chamada roda a versão de cada classe (polimorfismo)", () => {
    const setup = [
      MORFAVEL,
      'class RangerVermelho implements Morfavel { public void morfar() { System.out.println("Tiranossauro!"); } }',
      'class RangerPreto implements Morfavel { public void morfar() { System.out.println("Mastodonte!"); } }',
      "Morfavel a = new RangerVermelho();",
      "Morfavel b = new RangerPreto();",
    ];
    const first = run([...setup, "a.morfar()"], started());
    expect(first.output).toEqual(["Tiranossauro!"]);
    const second = run(["b.morfar()"], first.state);
    expect(second.output).toEqual(["Mastodonte!"]);
  });
});

describe("composição", () => {
  it("um objeto guarda outro objeto num campo", () => {
    const { output } = run(
      [
        'class Zord { String nome; Zord(String nome) { this.nome = nome; } String getNome() { return this.nome; } }',
        'class Ranger { Zord zord; Ranger(Zord zord) { this.zord = zord; } void chamar() { System.out.println("Preciso do " + this.zord.getNome() + "!"); } }',
        'Zord z = new Zord("Tiranossauro");',
        "Ranger r = new Ranger(z);",
        "r.chamar()",
      ],
      started()
    );
    expect(output).toEqual(["Preciso do Tiranossauro!"]);
  });
});

describe("comandos do jshell", () => {
  it("/types lista os tipos declarados com a herança", () => {
    const { output } = run(
      ["class Ranger { }", "class RangerVermelho extends Ranger { }", "/types"],
      started()
    );
    expect(output[0]).toContain("class Ranger");
    expect(output[1]).toContain("extends Ranger");
  });

  it("/vars lista as variáveis da sessão", () => {
    const { output } = run([RANGER, "Ranger r = new Ranger();", "/vars"], started());
    expect(output[0]).toContain("Ranger r =");
  });
});

describe("limites do simulador", () => {
  it("diz que if/for estão fora do subconjunto, sem fingir que é Java inválido", () => {
    const { ok, output } = run(["if (true) { }"], started());
    expect(ok).toBe(false);
    expect(output.join(" ")).toContain("fora do subconjunto");
  });

  it("entrada vazia não lança", () => {
    expect(() => runCommand("", createInitialJavaState())).not.toThrow();
  });

  it("entrada sem sentido vira erro, não exceção", () => {
    expect(() => runCommand("}{)(", started())).not.toThrow();
    expect(runCommand("}{)(", started()).ok).toBe(false);
  });
});
