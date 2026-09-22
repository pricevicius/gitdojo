import type { JavaState, JavaValue } from "../engine/java/types";
import { createInitialJavaState } from "../engine/java/types";
import { runCommand } from "../engine/java/commands";
import type { DojoChallenge } from "../dojo/types";

export type JavaChallenge = DojoChallenge<JavaState>;

export const JAVA_TRILHAS_ORDER = [
  "Classes e Objetos",
  "Encapsulamento",
  "Herança",
  "Polimorfismo",
  "Inspecionando a sessão",
] as const;

/**
 * Monta o estado inicial de um desafio rodando as linhas no próprio motor, em
 * vez de escrever a estrutura na mão. Assim o cenário de partida é
 * necessariamente um estado que o simulador sabe produzir — se um dia o parser
 * mudar e uma dessas linhas parar de valer, o teste de setup quebra na hora.
 */
function seed(...lines: string[]): JavaState {
  let state = createInitialJavaState();
  for (const line of lines) {
    const result = runCommand(line, state);
    if (!result.ok) {
      throw new Error(`setup de desafio falhou em '${line}': ${result.output.join(" ")}`);
    }
    state = result.state;
  }
  return state;
}

function open(): JavaState {
  return seed("jshell");
}

const RANGER_SIMPLES = "class Ranger { String cor; }";
const RANGER_COM_METODO =
  'class Ranger { String cor; void morfar() { System.out.println("Vai, " + this.cor + "!"); } }';
const RANGER_ENCAPSULADO =
  "class Ranger { private String cor; Ranger(String cor) { this.cor = cor; } }";
const MORFAVEL = "interface Morfavel { void morfar(); }";

// --- predicados usados pelos goals -----------------------------------------

function temClasse(s: JavaState, nome: string): boolean {
  return s.types[nome]?.kind === "class";
}

function temCampo(s: JavaState, classe: string, campo: string): boolean {
  return Boolean(s.types[classe]?.fields.some((f) => f.name === campo));
}

function temMetodo(s: JavaState, classe: string, metodo: string): boolean {
  return Boolean(s.types[classe]?.methods.some((m) => m.name === metodo));
}

/** Existe um objeto vivo cuja classe é `nome` (ou uma descendente dela). */
function objetosDe(s: JavaState, nome: string) {
  return Object.values(s.heap).filter((o) => {
    let current: string | null = o.className;
    while (current) {
      if (current === nome) return true;
      current = s.types[current]?.superName ?? null;
    }
    return false;
  });
}

function campoVale(valor: JavaValue | undefined, texto: string): boolean {
  return valor?.kind === "string" && valor.value === texto;
}

function imprimiu(s: JavaState, trecho: string): boolean {
  return s.printed.some((linha) => linha.toLowerCase().includes(trecho.toLowerCase()));
}

export const JAVA_CHALLENGES: JavaChallenge[] = [
  // --- Classes e Objetos ---------------------------------------------------
  {
    id: "jshell-1",
    trilha: "Classes e Objetos",
    title: "Abra o Java",
    description:
      "Para escrever Java normalmente você cria arquivos e compila. Mas o JDK traz um atalho: o jshell, um terminal onde você digita Java e vê o resultado na hora — perfeito para experimentar. Abra ele.",
    hint: "É só o nome do programa, sozinho, sem nenhum argumento.",
    setup: () => createInitialJavaState(),
    goal: (s) => s.jshellStarted,
  },
  {
    id: "classe-1",
    trilha: "Classes e Objetos",
    title: "A classe é o molde",
    description:
      "Antes de existir um Ranger, alguém precisou decidir o que todo Ranger é. Isso é uma classe: o molde, a planta, a descrição do que aquele tipo de coisa tem e faz. A classe não é um Ranger — é a receita de Ranger. Declare uma classe chamada Ranger, ainda vazia.",
    hint: 'A palavra "class", o nome, e um par de chaves vazio: class Ranger { }',
    setup: open,
    goal: (s) => temClasse(s, "Ranger"),
  },
  {
    id: "campo-1",
    trilha: "Classes e Objetos",
    title: "O que todo Ranger tem",
    description:
      "Todo Ranger tem uma cor — é o que os diferencia. Uma informação que cada objeto guarda dentro de si se chama campo (ou atributo). Declare a classe Ranger de novo, agora com um campo chamado cor, do tipo String (que é como o Java chama texto).",
    hint: "Dentro das chaves, escreva o tipo e o nome, terminando em ponto e vírgula: class Ranger { String cor; }",
    starter: `class Ranger {
    // declare aqui o campo: um texto (String) chamado cor
}`,
    setup: open,
    goal: (s) => temCampo(s, "Ranger", "cor"),
  },
  {
    id: "new-1",
    trilha: "Classes e Objetos",
    title: "Do molde para o Ranger de verdade",
    description:
      "A classe existe, mas ainda não há nenhum Ranger — do mesmo jeito que uma receita de bolo não é um bolo. Quem transforma o molde em coisa concreta é a palavra new: ela constrói um objeto, uma instância daquela classe. Crie um Ranger e guarde ele numa variável chamada r.",
    hint: 'Tipo, nome da variável, igual, e o new: Ranger r = new Ranger();',
    starter: `// a classe Ranger ja existe nesta sessao.
// crie um objeto dela e guarde na variavel r:
`,
    setup: () => seed("jshell", RANGER_SIMPLES),
    goal: (s) => objetosDe(s, "Ranger").length > 0 && Boolean(s.vars.r),
  },
  {
    id: "campo-valor-1",
    trilha: "Classes e Objetos",
    title: "Este Ranger é o vermelho",
    description:
      'O objeto r existe, mas a cor dele ainda é null — "nada", o vazio do Java, porque ninguém preencheu. Cada objeto tem sua própria cópia dos campos: mexer no r não mexe em nenhum outro Ranger. Coloque "Vermelho" na cor do r.',
    hint: 'Use o ponto para chegar no campo do objeto e o igual para atribuir: r.cor = "Vermelho";',
    starter: `// o objeto r ja existe, mas a cor dele esta vazia (null).
// coloque "Vermelho" na cor dele:
`,
    setup: () => seed("jshell", RANGER_SIMPLES, "Ranger r = new Ranger();"),
    goal: (s) => objetosDe(s, "Ranger").some((o) => campoVale(o.fields.cor, "Vermelho")),
  },
  {
    id: "dois-objetos-1",
    trilha: "Classes e Objetos",
    title: "Um molde, vários Rangers",
    description:
      "O valor de uma classe é poder criar quantos objetos quiser a partir dela, cada um com seus próprios valores. Você já tem o r (vermelho). Crie um segundo Ranger numa variável chamada a, e deixe a cor dele como \"Azul\" — repare que o r continua vermelho.",
    hint: "São dois passos: primeiro Ranger a = new Ranger(); depois a.cor = \"Azul\";",
    starter: `// r ja existe e e vermelho.
// crie o segundo Ranger, na variavel a, e deixe ele azul:
`,
    setup: () => seed("jshell", RANGER_SIMPLES, "Ranger r = new Ranger();", 'r.cor = "Vermelho";'),
    goal: (s) =>
      objetosDe(s, "Ranger").some((o) => campoVale(o.fields.cor, "Vermelho")) &&
      objetosDe(s, "Ranger").some((o) => campoVale(o.fields.cor, "Azul")),
  },
  {
    id: "metodo-1",
    trilha: "Classes e Objetos",
    title: "O que todo Ranger faz",
    description:
      "Um objeto não é só dado parado: ele também sabe fazer coisas. Uma ação que a classe define se chama método. Declare a classe Ranger com o campo cor e um método morfar() que imprime na tela a frase de transformação usando a cor — depois crie um Ranger e chame o método nele.",
    hint: 'O método vai dentro da classe: void morfar() { System.out.println("Vai, " + this.cor + "!"); } — o "this" quer dizer "o objeto em que o método foi chamado".',
    starter: `class Ranger {
    String cor;

    // escreva aqui o metodo morfar(),
    // que imprime a frase usando this.cor
}

// depois: crie um Ranger, de uma cor a ele e chame morfar()
`,
    setup: open,
    goal: (s) => temMetodo(s, "Ranger", "morfar") && imprimiu(s, "vai,"),
  },

  // --- Encapsulamento ------------------------------------------------------
  {
    id: "private-1",
    trilha: "Encapsulamento",
    title: "Tranque a cor por dentro",
    description:
      'Do jeito que está, qualquer um pode escrever r.cor = "Rosa choque" e bagunçar o Ranger. Encapsular é esconder o que é interno e controlar quem mexe. A palavra private faz isso: o campo passa a só ser acessível de dentro da própria classe. Declare Ranger com a cor private.',
    hint: "É só uma palavra antes do tipo do campo: class Ranger { private String cor; }",
    starter: `class Ranger {
    String cor;   // deixe este campo acessivel so de dentro da classe
}`,
    setup: open,
    goal: (s) =>
      Boolean(s.types.Ranger?.fields.some((f) => f.name === "cor" && f.visibility === "private")),
  },
  {
    id: "construtor-1",
    trilha: "Encapsulamento",
    title: "Nasça já com a cor certa",
    description:
      "Se ninguém pode mexer na cor de fora, como o Ranger ganha uma? No momento do nascimento. O construtor é um bloco especial, com o mesmo nome da classe, que roda uma única vez quando o objeto é criado — é onde os campos recebem seus valores iniciais. Declare Ranger com cor private e um construtor que recebe a cor, e crie o Ranger vermelho.",
    hint: 'O construtor não tem tipo de retorno: Ranger(String cor) { this.cor = cor; } — e depois use new Ranger("Vermelho");',
    starter: `class Ranger {
    private String cor;

    // escreva aqui o construtor, que recebe a cor
}

// depois: crie o Ranger vermelho
`,
    setup: open,
    goal: (s) =>
      (s.types.Ranger?.constructor?.params.length ?? 0) === 1 &&
      objetosDe(s, "Ranger").some((o) => campoVale(o.fields.cor, "Vermelho")),
  },
  {
    id: "getter-1",
    trilha: "Encapsulamento",
    title: "Uma janela para ver a cor",
    description:
      "Campo private não pode ser lido de fora — experimente r.cor e veja o erro. Mas às vezes quem está de fora precisa saber a cor. A saída é a classe oferecer um método que devolve o valor: um getter. Assim a classe continua no controle. Declare Ranger com cor private, construtor, e um método getCor() que devolve a cor; depois crie um Ranger e chame getCor() nele.",
    hint: "O método declara o tipo que devolve e usa return: String getCor() { return this.cor; }",
    starter: `class Ranger {
    private String cor;

    Ranger(String cor) {
        this.cor = cor;
    }

    // escreva aqui o getCor(), que devolve a cor
}

// depois: crie um Ranger e chame getCor() nele
`,
    setup: open,
    goal: (s) => temMetodo(s, "Ranger", "getCor") && objetosDe(s, "Ranger").length > 0,
  },

  // --- Herança -------------------------------------------------------------
  {
    id: "extends-1",
    trilha: "Herança",
    title: "Um tipo especial de Ranger",
    description:
      "O Ranger Verde é um Ranger: tem cor, morfa, tudo igual — e ainda tem a Flauta do Dragão. Reescrever tudo seria desperdício. Herança é dizer que uma classe é uma versão especializada de outra e já nasce com tudo que a mãe tem. Declare RangerVerde como uma classe que estende Ranger.",
    hint: "A palavra é extends, entre o nome novo e o nome da mãe: class RangerVerde extends Ranger { }",
    starter: `// a classe Ranger ja existe.
// declare RangerVerde como uma versao especializada dela:
`,
    setup: () => seed("jshell", RANGER_COM_METODO),
    goal: (s) => s.types.RangerVerde?.superName === "Ranger",
  },
  {
    id: "super-1",
    trilha: "Herança",
    title: "Avise à classe mãe qual é a cor",
    description:
      "A classe Ranger só nasce com uma cor definida no construtor dela. Quando a filha é criada, ela precisa dizer à mãe com que cor nascer — e quem faz esse recado é super(...), a chamada ao construtor da classe mãe. Declare RangerVerde estendendo Ranger, com um construtor que passe \"Verde\" para a mãe, e crie um RangerVerde.",
    hint: 'O super(...) é a primeira linha do construtor da filha: RangerVerde() { super("Verde"); }',
    starter: `// Ranger exige uma cor no construtor dele.
// declare RangerVerde passando "Verde" para a mae, e crie um:
`,
    setup: () => seed("jshell", RANGER_ENCAPSULADO),
    goal: (s) =>
      s.types.RangerVerde?.superName === "Ranger" &&
      objetosDe(s, "RangerVerde").some((o) => campoVale(o.fields.cor, "Verde")),
  },
  {
    id: "override-1",
    trilha: "Herança",
    title: "A filha faz do seu jeito",
    description:
      "O RangerVerde herdou morfar() da mãe, mas a transformação dele é diferente: tem a Flauta do Dragão. Quando a filha escreve um método com o mesmo nome da mãe, ela sobrescreve o comportamento — e é a versão dela que roda. Declare RangerVerde estendendo Ranger com um morfar() próprio que imprima algo sobre a flauta, e chame morfar() num RangerVerde.",
    hint: 'Escreva o mesmo método de novo na filha, marcado com @Override: @Override void morfar() { System.out.println("Flauta do Dragao!"); }',
    starter: `// Ranger ja tem um morfar().
// escreva RangerVerde com um morfar() proprio (a Flauta do Dragao),
// depois crie um RangerVerde e chame morfar() nele:
`,
    setup: () => seed("jshell", RANGER_COM_METODO),
    goal: (s) =>
      temMetodo(s, "RangerVerde", "morfar") &&
      s.types.RangerVerde?.superName === "Ranger" &&
      imprimiu(s, "flauta"),
  },

  // --- Polimorfismo --------------------------------------------------------
  {
    id: "interface-1",
    trilha: "Polimorfismo",
    title: "Um contrato, não um molde",
    description:
      "Nem tudo que morfa é um Ranger — o Zord também se transforma, e não faz sentido dizer que um Zord é um Ranger. Uma interface resolve isso: ela não é um molde com dados, é um contrato que diz só quais ações existem, sem dizer como. Declare uma interface Morfavel com um método morfar() sem corpo.",
    hint: "A assinatura termina em ponto e vírgula, sem chaves: interface Morfavel { void morfar(); }",
    setup: open,
    goal: (s) => s.types.Morfavel?.kind === "interface" && temMetodo(s, "Morfavel", "morfar"),
  },
  {
    id: "implements-1",
    trilha: "Polimorfismo",
    title: "Assine o contrato",
    description:
      "Uma classe que implementa uma interface se compromete a escrever todos os métodos dela — se não escrever, o Java cobra. Declare a classe RangerVermelho implementando Morfavel, com o método morfar() imprimindo o chamado do Zord dele, e crie um objeto para chamar morfar().",
    hint: 'A palavra é implements: class RangerVermelho implements Morfavel { public void morfar() { System.out.println("Tiranossauro!"); } }',
    starter: `// a interface Morfavel ja existe.
class RangerVermelho implements Morfavel {
    // escreva aqui o morfar()
}

// depois: crie um RangerVermelho e chame morfar() nele
`,
    setup: () => seed("jshell", MORFAVEL),
    goal: (s) =>
      Boolean(s.types.RangerVermelho?.interfaces.includes("Morfavel")) &&
      temMetodo(s, "RangerVermelho", "morfar") &&
      s.printed.length > 0,
  },
  {
    id: "polimorfismo-1",
    trilha: "Polimorfismo",
    title: "A mesma ordem, respostas diferentes",
    description:
      "Aqui está o pulo do gato da orientação a objetos. Crie uma classe RangerPreto que também implementa Morfavel, com o morfar() dele. Agora guarde um RangerVermelho e um RangerPreto em variáveis do tipo Morfavel e chame morfar() nas duas: o comando é idêntico, mas cada objeto responde do seu jeito. Isso é polimorfismo — quem chama não precisa saber qual Ranger é.",
    hint: 'A variável pode ter o tipo da interface: Morfavel m = new RangerPreto(); e então m.morfar()',
    starter: `// Morfavel e RangerVermelho ja existem.

// 1. declare RangerPreto implementando Morfavel


// 2. guarde um de cada em variaveis do tipo Morfavel


// 3. chame morfar() nas duas
`,
    setup: () =>
      seed(
        "jshell",
        MORFAVEL,
        'class RangerVermelho implements Morfavel { public void morfar() { System.out.println("Tiranossauro!"); } }'
      ),
    goal: (s) => {
      const implementam = Object.values(s.types).filter((t) => t.interfaces.includes("Morfavel"));
      const viaInterface = Object.values(s.vars).filter((v) => v.declaredType === "Morfavel");
      return implementam.length >= 2 && viaInterface.length >= 2 && s.printed.length >= 2;
    },
  },

  // --- Inspecionando a sessão ---------------------------------------------
  {
    id: "types-1",
    trilha: "Inspecionando a sessão",
    title: "Veja a família inteira",
    description:
      "Depois de declarar várias classes, é fácil perder o fio da meada de quem herda de quem. O jshell responde isso: existe um comando dele — não é Java, é do terminal, por isso começa com barra — que lista todos os tipos da sessão com suas heranças. Use ele.",
    hint: "Começa com barra e é o plural de 'tipo', em inglês.",
    setup: () =>
      seed(
        "jshell",
        RANGER_COM_METODO,
        'class RangerVerde extends Ranger { @Override void morfar() { System.out.println("Flauta!"); } }'
      ),
    goal: (s) => s.lastCommand === "/types",
  },
  {
    id: "vars-1",
    trilha: "Inspecionando a sessão",
    title: "E os objetos que você criou",
    description:
      "Do mesmo jeito, dá para listar todas as variáveis vivas na sessão e o que cada uma guarda — útil para conferir se um objeto ficou com o valor que você esperava. Liste as variáveis.",
    hint: "Também começa com barra, e é a abreviação de 'variables'.",
    setup: () =>
      seed(
        "jshell",
        RANGER_SIMPLES,
        "Ranger r = new Ranger();",
        'r.cor = "Vermelho";',
        "Ranger a = new Ranger();",
        'a.cor = "Azul";'
      ),
    goal: (s) => s.lastCommand === "/vars",
  },
];
