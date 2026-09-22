import type { DictionaryEntry } from "../dojo/types";

/**
 * As chaves batem com o `unlockedCommand` devolvido por
 * `src/engine/java/commands.ts` — é assim que o verbete é desbloqueado.
 * A `category` precisa ser uma das trilhas de JAVA_TRILHAS_ORDER, porque o
 * acordeão do dicionário agrupa por trilha (ver Dictionary.tsx).
 *
 * Aqui os "comandos" não são subcomandos de um binário, como nos outros
 * dojos, e sim as palavras-chave da linguagem — é o que a pessoa de fato
 * aprende a escrever numa trilha de orientação a objetos.
 */
export const JAVA_DICTIONARY: Record<string, DictionaryEntry> = {
  jshell: {
    command: "jshell",
    category: "Classes e Objetos",
    short:
      "Abre o REPL do Java: um terminal onde cada linha digitada é executada na hora, sem precisar criar arquivo nem compilar.",
    example: "jshell",
  },
  "java --version": {
    command: "java --version",
    category: "Classes e Objetos",
    short: "Mostra a versão do Java instalada. O jshell existe a partir do Java 9.",
    example: "java --version",
  },
  class: {
    command: "class",
    category: "Classes e Objetos",
    short:
      "Declara o molde de um tipo de objeto: o que ele tem (campos) e o que ele faz (métodos). A classe em si não é um objeto.",
    example: "class Ranger { String cor; }",
  },
  new: {
    command: "new",
    category: "Classes e Objetos",
    short:
      "Constrói um objeto a partir de uma classe. Cada new produz um objeto novo, com sua própria cópia dos campos.",
    example: "Ranger r = new Ranger();",
  },
  this: {
    command: "this",
    category: "Classes e Objetos",
    short:
      "Dentro de um método ou construtor, aponta para o próprio objeto que recebeu a chamada. Serve para distinguir o campo do objeto de um parâmetro de mesmo nome.",
    example: "void morfar() { System.out.println(this.cor); }",
  },
  "System.out.println": {
    command: "System.out.println",
    category: "Classes e Objetos",
    short: "Imprime uma linha no terminal. O + junta textos e valores numa string só.",
    example: 'System.out.println("Vai, " + this.cor + "!");',
  },

  private: {
    command: "private",
    category: "Encapsulamento",
    short:
      "Restringe o acesso ao campo ou método à própria classe. É o que impede o mundo lá fora de mexer direto no estado do objeto.",
    example: "class Ranger { private String cor; }",
  },
  construtor: {
    command: "construtor",
    category: "Encapsulamento",
    short:
      "Bloco com o mesmo nome da classe e sem tipo de retorno, executado uma única vez quando o objeto é criado. É onde os campos recebem seus valores iniciais.",
    example: "Ranger(String cor) { this.cor = cor; }",
  },

  extends: {
    command: "extends",
    category: "Herança",
    short:
      "Declara que uma classe é uma versão especializada de outra, herdando todos os campos e métodos dela.",
    example: "class RangerVerde extends Ranger { }",
  },
  super: {
    command: "super",
    category: "Herança",
    short:
      "Alcança a classe mãe: super(...) chama o construtor dela, super.metodo() chama a versão dela de um método que você sobrescreveu.",
    example: 'RangerVerde() { super("Verde"); }',
  },
  "@Override": {
    command: "@Override",
    category: "Herança",
    short:
      "Marca um método que substitui o da classe mãe. Não muda o comportamento, mas faz o compilador avisar se você errar o nome e criar um método novo sem querer.",
    example: '@Override void morfar() { System.out.println("Flauta do Dragao!"); }',
  },

  interface: {
    command: "interface",
    category: "Polimorfismo",
    short:
      "Um contrato: declara quais métodos existem, sem dizer como funcionam e sem guardar dados. Não pode virar objeto com new.",
    example: "interface Morfavel { void morfar(); }",
  },
  implements: {
    command: "implements",
    category: "Polimorfismo",
    short:
      "Compromete a classe a escrever todos os métodos declarados na interface. Feito isso, ela pode ser usada em qualquer lugar que espere aquele contrato.",
    example: "class RangerVermelho implements Morfavel { public void morfar() { } }",
  },

  "/types": {
    command: "/types",
    category: "Inspecionando a sessão",
    short: "Lista as classes e interfaces declaradas na sessão, com as heranças de cada uma.",
    example: "/types",
  },
  "/vars": {
    command: "/vars",
    category: "Inspecionando a sessão",
    short: "Lista as variáveis vivas na sessão e o valor atual de cada uma.",
    example: "/vars",
  },
  "/methods": {
    command: "/methods",
    category: "Inspecionando a sessão",
    short: "Lista os métodos declarados, com o tipo de retorno e os tipos dos parâmetros.",
    example: "/methods",
  },
  "/help": {
    command: "/help",
    category: "Inspecionando a sessão",
    short: "Mostra os comandos do próprio jshell — os que começam com barra não são Java.",
    example: "/help",
  },
  "/exit": {
    command: "/exit",
    category: "Inspecionando a sessão",
    short: "Fecha o jshell e volta para o shell. Tudo que foi declarado na sessão se perde.",
    example: "/exit",
  },
};
