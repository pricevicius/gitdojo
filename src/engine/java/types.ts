/**
 * Estado de uma sessão do `jshell` — o REPL oficial do Java, que vem junto com
 * o JDK desde a versão 9. Diferente do git (que tem um repositório em disco) ou
 * do wp-cli (que tem um site), o "recurso" simulado aqui é a memória do próprio
 * REPL: os tipos que você declarou e os objetos que você criou continuam vivos
 * entre um comando e outro, e é isso que os desafios de OOP observam.
 */

export type Visibility = "public" | "private" | "protected" | "package";

/** Valor de um campo ou variável. `ref` aponta para um objeto no heap. */
export type JavaValue =
  | { kind: "string"; value: string }
  | { kind: "int"; value: number }
  | { kind: "boolean"; value: boolean }
  | { kind: "ref"; objectId: string }
  | { kind: "null" };

export interface JavaParam {
  name: string;
  type: string;
}

export interface JavaFieldDecl {
  name: string;
  type: string;
  visibility: Visibility;
  /** Expressão crua do `= ...`, avaliada quando o objeto é construído. */
  initializer: string | null;
}

export interface JavaMethodDecl {
  name: string;
  returnType: string;
  params: JavaParam[];
  visibility: Visibility;
  /** Statements crus; só são interpretados na hora da chamada. */
  body: string[];
  hasOverrideAnnotation: boolean;
  /** Método de interface, declarado sem corpo. */
  abstract: boolean;
}

export interface JavaConstructorDecl {
  params: JavaParam[];
  body: string[];
}

export interface JavaTypeDecl {
  name: string;
  kind: "class" | "interface";
  superName: string | null;
  interfaces: string[];
  fields: JavaFieldDecl[];
  constructor: JavaConstructorDecl | null;
  methods: JavaMethodDecl[];
}

/** Um objeto vivo no heap da sessão. */
export interface JavaObject {
  id: string;
  className: string;
  fields: Record<string, JavaValue>;
}

/** Uma variável declarada no REPL (`Ranger r = new Ranger();`). */
export interface JavaVariable {
  name: string;
  /** O tipo escrito na declaração — pode ser mais genérico que o da instância,
   * que é justamente o que torna o polimorfismo visível. */
  declaredType: string;
  value: JavaValue;
}

export interface JavaState {
  /** O REPL já foi aberto (o comando `jshell` no shell). */
  jshellStarted: boolean;
  types: Record<string, JavaTypeDecl>;
  heap: Record<string, JavaObject>;
  vars: Record<string, JavaVariable>;
  /** Ordem de declaração, para `/types` e `/vars` responderem como o jshell. */
  typeOrder: string[];
  varOrder: string[];
  /** Tudo que já saiu por System.out.println nesta sessão. */
  printed: string[];
  objectCounter: number;
  /** Contador dos nomes temporários que o jshell dá a expressões soltas ($1, $2...). */
  scratchCounter: number;
  lastCommand: string | null;
}

export interface JavaCommandResult {
  ok: boolean;
  output: string[];
  state: JavaState;
  unlockedCommand?: string;
  /** Um envio do editor pode ensinar vários conceitos de uma vez. */
  unlockedCommands?: string[];
}

export function createInitialJavaState(): JavaState {
  return {
    jshellStarted: false,
    types: {},
    heap: {},
    vars: {},
    typeOrder: [],
    varOrder: [],
    printed: [],
    objectCounter: 0,
    scratchCounter: 0,
    lastCommand: null,
  };
}
