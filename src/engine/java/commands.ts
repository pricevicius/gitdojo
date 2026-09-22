import type {
  JavaCommandResult,
  JavaFieldDecl,
  JavaMethodDecl,
  JavaObject,
  JavaParam,
  JavaState,
  JavaTypeDecl,
  JavaValue,
  Visibility,
} from "./types";

/**
 * Motor do dojo de Java. Segue o padrão de dois modos do dojo de Claude Code:
 * fora do REPL só o binário `jshell` (e `java --version`) é reconhecido;
 * dentro dele, você digita Java de verdade, sem prefixo.
 *
 * O que é interpretado é um subconjunto de Java escolhido para ensinar OOP a
 * quem nunca viu o assunto: declaração de classe e interface, campos,
 * construtor, métodos, `new`, herança (`extends`/`super`), interface
 * (`implements`) e despacho polimórfico. Deliberadamente fora do subconjunto,
 * porque não são o assunto da trilha e dobrariam o tamanho do parser:
 * controle de fluxo (if/for/while), arrays e coleções, genéricos, sobrecarga
 * de método, static, exceções e números com ponto flutuante. Quando a pessoa
 * digita algo assim, o erro diz explicitamente que é limite do simulador e
 * não Java inválido — confundir os dois seria ensinar errado.
 */

const MODIFIERS = new Set(["public", "private", "protected", "static", "final", "abstract"]);

const UNSUPPORTED_KEYWORDS: Record<string, string> = {
  if: "controle de fluxo (if/else)",
  for: "laços (for)",
  while: "laços (while)",
  switch: "switch",
  try: "tratamento de exceção (try/catch)",
  throw: "tratamento de exceção (throw)",
  enum: "enum",
  record: "record",
};

function clone(state: JavaState): JavaState {
  return JSON.parse(JSON.stringify(state)) as JavaState;
}

function fail(state: JavaState, ...lines: string[]): JavaCommandResult {
  return { ok: false, output: lines, state };
}

function ok(state: JavaState, lines: string[], unlockedCommand?: string): JavaCommandResult {
  return { ok: true, output: lines, state, unlockedCommand };
}

/** Erro de interpretação; vira uma linha de erro no terminal. */
class JavaError extends Error {}

function jerror(message: string): never {
  throw new JavaError(message);
}

// ---------------------------------------------------------------------------
// Varredura de texto: tudo abaixo respeita aspas e aninhamento de ()/{}.
// ---------------------------------------------------------------------------

/** Índice do fecha-parênteses/chave que casa com o abre em `openIdx`. */
function findMatching(src: string, openIdx: number): number {
  const open = src[openIdx];
  const close = open === "(" ? ")" : open === "{" ? "}" : null;
  if (!close) return -1;
  let depth = 0;
  let inString = false;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Quebra `src` no separador, ignorando o que está dentro de aspas ou de ()/{}. */
function splitTopLevel(src: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let buf = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      buf += c;
      if (c === "\\" && i + 1 < src.length) {
        buf += src[++i];
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      buf += c;
    } else if (c === "(" || c === "{" || c === "[") {
      depth++;
      buf += c;
    } else if (c === ")" || c === "}" || c === "]") {
      depth--;
      buf += c;
    } else if (c === separator && depth === 0) {
      parts.push(buf);
      buf = "";
    } else {
      buf += c;
    }
  }
  parts.push(buf);
  return parts;
}

/**
 * Quebra o corpo de uma classe nos seus membros. Um membro termina em `;`
 * (campo, método de interface) ou no `}` que fecha o bloco dele (construtor,
 * método com corpo).
 */
function splitMembers(body: string): string[] {
  const members: string[] = [];
  let depth = 0;
  let inString = false;
  let buf = "";
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    buf += c;
    if (inString) {
      if (c === "\\" && i + 1 < body.length) buf += body[++i];
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        members.push(buf.trim());
        buf = "";
      }
    } else if (c === ";" && depth === 0) {
      members.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) members.push(buf.trim());
  return members.filter((m) => m.length > 0 && m !== ";");
}

/** Statements de um corpo de método, separados por `;` no nível de cima. */
function splitStatements(body: string): string[] {
  return splitTopLevel(body, ";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Parsing de declarações
// ---------------------------------------------------------------------------

interface Modifiers {
  visibility: Visibility;
  rest: string;
  hasOverride: boolean;
  isAbstract: boolean;
  isStatic: boolean;
}

function stripModifiers(src: string): Modifiers {
  let rest = src.trim();
  let visibility: Visibility = "package";
  let hasOverride = false;
  let isAbstract = false;
  let isStatic = false;

  while (rest.startsWith("@Override")) {
    hasOverride = true;
    rest = rest.slice("@Override".length).trim();
  }

  let changed = true;
  while (changed) {
    changed = false;
    const word = rest.split(/\s+/)[0];
    if (MODIFIERS.has(word)) {
      if (word === "public" || word === "private" || word === "protected") visibility = word;
      if (word === "abstract") isAbstract = true;
      if (word === "static") isStatic = true;
      rest = rest.slice(word.length).trim();
      changed = true;
    }
    if (rest.startsWith("@Override")) {
      hasOverride = true;
      rest = rest.slice("@Override".length).trim();
      changed = true;
    }
  }

  return { visibility, rest, hasOverride, isAbstract, isStatic };
}

function parseParams(src: string): JavaParam[] {
  const inner = src.trim();
  if (!inner) return [];
  return splitTopLevel(inner, ",").map((chunk) => {
    const parts = chunk.trim().split(/\s+/).filter(Boolean);
    if (parts.length !== 2) {
      jerror(
        `parâmetro inválido: '${chunk.trim()}' — em Java todo parâmetro tem tipo e nome, ex: (String cor)`
      );
    }
    return { type: parts[0], name: parts[1] };
  });
}

function parseTypeDeclaration(src: string, kind: "class" | "interface"): JavaTypeDecl {
  const openIdx = src.indexOf("{");
  if (openIdx === -1) {
    jerror(
      `faltou abrir o corpo com '{'. Uma ${kind === "class" ? "classe" : "interface"} sempre tem um bloco: ${kind} Nome { ... }`
    );
  }
  const closeIdx = findMatching(src, openIdx);
  if (closeIdx === -1) jerror("faltou fechar o corpo com '}'.");

  const header = src.slice(0, openIdx).trim();
  const body = src.slice(openIdx + 1, closeIdx);

  const headerWords = header.split(/\s+/).filter(Boolean);
  // headerWords[0] é 'class' ou 'interface'
  const name = headerWords[1];
  if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    jerror(`'${name ?? ""}' não é um nome válido. Use um nome começando com letra, ex: ${kind} Ranger { }`);
  }

  let superName: string | null = null;
  const interfaces: string[] = [];
  const extendsIdx = headerWords.indexOf("extends");
  if (extendsIdx !== -1) {
    superName = headerWords[extendsIdx + 1] ?? null;
    if (!superName) jerror("depois de 'extends' falta o nome da classe mãe.");
  }
  const implementsIdx = headerWords.indexOf("implements");
  if (implementsIdx !== -1) {
    const names = headerWords
      .slice(implementsIdx + 1)
      .join(" ")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) jerror("depois de 'implements' falta o nome da interface.");
    interfaces.push(...names);
  }

  const decl: JavaTypeDecl = {
    name,
    kind,
    superName,
    interfaces,
    fields: [],
    constructor: null,
    methods: [],
  };

  for (const rawMember of splitMembers(body)) {
    parseMember(rawMember, decl);
  }
  return decl;
}

/**
 * O erro mais comum de quem está começando: escrever um comando solto dentro
 * do corpo da classe. Acontece naturalmente porque o editor indenta para
 * dentro das chaves depois de `class Ranger {`, e a pessoa segue digitando
 * ali. Sem este diagnóstico, o parser leria `new Ranger();` como a declaração
 * de um método chamado Ranger e reclamaria de "corpo entre chaves" — uma
 * mensagem correta e inútil, que deixa a pessoa travada.
 */
function statementInsideClassBody(member: string): string | null {
  const m = member.trim();
  if (/^new\s+[A-Z]/.test(m)) return "criar um objeto";
  if (/^System\.out\./.test(m)) return "imprimir na tela";
  if (/^[a-z]\w*\s*\.\s*\w+\s*\(/.test(m)) return "chamar um método de um objeto";
  if (/^[a-z]\w*\s*=/.test(m)) return "atribuir um valor a uma variável";
  if (/^[A-Z]\w*\s+[a-z]\w*\s*=\s*new\s/.test(m)) return "criar um objeto";
  return null;
}

function parseMember(rawMember: string, decl: JavaTypeDecl): void {
  const { visibility, rest, hasOverride } = stripModifiers(rawMember);
  const member = rest.replace(/;$/, "").trim();
  if (!member) return;

  const acao = statementInsideClassBody(member);
  if (acao) {
    jerror(
      `'${member}' está dentro do corpo da classe ${decl.name}, e é um comando para ${acao}. ` +
        `O corpo de uma classe só declara o que ela TEM (campos, ex: String cor;) e o que ela FAZ ` +
        `(métodos, ex: void morfar() { ... }). Comandos ficam FORA da classe: escreva essa linha ` +
        `depois do '}' que fecha ${decl.name}.`
    );
  }

  const parenIdx = member.indexOf("(");
  const braceIdx = member.indexOf("{");
  const isCallable = parenIdx !== -1 && (braceIdx === -1 || parenIdx < braceIdx);

  if (!isCallable) {
    // Campo: `Tipo nome` ou `Tipo nome = expressão`
    const eqParts = splitTopLevel(member, "=");
    const left = eqParts[0].trim();
    const initializer = eqParts.length > 1 ? eqParts.slice(1).join("=").trim() : null;
    const words = left.split(/\s+/).filter(Boolean);
    if (words.length !== 2) {
      jerror(
        `não entendi '${member.replace(/\s+/g, " ")}'. Um campo se declara como 'Tipo nome;' ` +
          `(ex: String cor;) — e cada um precisa do seu ponto e vírgula no fim. ` +
          `Se você declarou mais de um campo, confira se não faltou um ';' separando eles.`
      );
    }
    if (!rawMember.trim().endsWith(";")) {
      jerror(
        `faltou o ponto e vírgula depois de '${left}'. Em Java toda declaração de campo termina ` +
          `em ';' — é assim que o compilador sabe onde ela acaba.`
      );
    }
    const field: JavaFieldDecl = {
      name: words[1],
      type: words[0],
      visibility,
      initializer,
    };
    if (decl.fields.some((f) => f.name === field.name)) {
      jerror(`variable ${field.name} is already defined in ${decl.kind} ${decl.name}`);
    }
    decl.fields.push(field);
    return;
  }

  const closeParen = findMatching(member, parenIdx);
  if (closeParen === -1) jerror(`faltou fechar o parêntese em '${member}'.`);

  const beforeParen = member.slice(0, parenIdx).trim();
  const paramsSrc = member.slice(parenIdx + 1, closeParen);
  const afterParen = member.slice(closeParen + 1).trim();

  const headWords = beforeParen.split(/\s+/).filter(Boolean);
  const params = parseParams(paramsSrc);

  let body: string[] = [];
  let hasBody = false;
  if (afterParen.startsWith("{")) {
    const bodyClose = findMatching(afterParen, 0);
    if (bodyClose === -1) jerror(`faltou fechar o corpo de '${beforeParen}' com '}'.`);
    body = splitStatements(afterParen.slice(1, bodyClose));
    hasBody = true;
  }

  // Construtor: mesmo nome da classe e sem tipo de retorno.
  if (headWords.length === 1 && headWords[0] === decl.name) {
    if (!hasBody) jerror(`o construtor de ${decl.name} precisa de um corpo: ${decl.name}(...) { ... }`);
    if (decl.constructor) {
      jerror(
        `${decl.name} já tem um construtor. Sobrecarga (dois construtores com assinaturas diferentes) não é suportada neste simulador.`
      );
    }
    decl.constructor = { params, body };
    return;
  }

  if (headWords.length !== 2) {
    jerror(
      `não entendi '${beforeParen}'. Um método se declara como 'TipoDeRetorno nome(params)', ex: void morfar()`
    );
  }

  const method: JavaMethodDecl = {
    returnType: headWords[0],
    name: headWords[1],
    params,
    visibility,
    body,
    hasOverrideAnnotation: hasOverride,
    abstract: !hasBody,
  };

  if (decl.kind === "interface" && hasBody) {
    jerror(
      `em ${decl.name}, o método ${method.name} tem corpo. Neste simulador uma interface só declara assinaturas (sem corpo): void ${method.name}();`
    );
  }
  if (decl.kind === "class" && !hasBody) {
    jerror(`em ${decl.name}, o método ${method.name} precisa de um corpo entre chaves.`);
  }
  if (decl.methods.some((m) => m.name === method.name)) {
    jerror(
      `${decl.name} já tem um método chamado ${method.name}. Sobrecarga de método não é suportada neste simulador.`
    );
  }
  decl.methods.push(method);
}

// ---------------------------------------------------------------------------
// Hierarquia de tipos
// ---------------------------------------------------------------------------

/** A classe e todas as suas ancestrais, da mais específica para a mais genérica. */
function classChain(state: JavaState, className: string): JavaTypeDecl[] {
  const chain: JavaTypeDecl[] = [];
  let current: string | null = className;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    const decl: JavaTypeDecl | undefined = state.types[current];
    if (!decl) break;
    chain.push(decl);
    current = decl.superName;
  }
  return chain;
}

/** Todas as interfaces implementadas pela classe ou por alguma ancestral. */
function allInterfaces(state: JavaState, className: string): string[] {
  const names: string[] = [];
  for (const decl of classChain(state, className)) {
    for (const i of decl.interfaces) {
      if (!names.includes(i)) names.push(i);
    }
  }
  return names;
}

function isSubtype(state: JavaState, className: string, target: string): boolean {
  if (className === target) return true;
  if (classChain(state, className).some((d) => d.name === target)) return true;
  return allInterfaces(state, className).includes(target);
}

interface FoundMethod {
  decl: JavaMethodDecl;
  ownerClass: string;
}

/**
 * Procura o método subindo a cadeia de herança a partir de `startClass`.
 * É aqui que o polimorfismo acontece: a busca começa na classe *real* do
 * objeto, então a versão sobrescrita vence a da classe mãe.
 */
function findMethod(
  state: JavaState,
  startClass: string,
  methodName: string,
  argCount: number
): FoundMethod | null {
  for (const decl of classChain(state, startClass)) {
    const m = decl.methods.find((x) => x.name === methodName && !x.abstract);
    if (m) {
      if (m.params.length !== argCount) {
        jerror(
          `method ${methodName} in class ${decl.name} cannot be applied to given types — ele espera ${m.params.length} argumento(s) e recebeu ${argCount}.`
        );
      }
      return { decl: m, ownerClass: decl.name };
    }
  }
  return null;
}

function findField(state: JavaState, className: string, fieldName: string): { decl: JavaFieldDecl; ownerClass: string } | null {
  for (const decl of classChain(state, className)) {
    const f = decl.fields.find((x) => x.name === fieldName);
    if (f) return { decl: f, ownerClass: decl.name };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

function defaultValue(type: string): JavaValue {
  if (type === "int" || type === "long" || type === "short" || type === "byte") {
    return { kind: "int", value: 0 };
  }
  if (type === "boolean") return { kind: "boolean", value: false };
  return { kind: "null" };
}

/** Pseudo-hash estável, no formato que o `toString()` padrão do Java imprime. */
function identityHash(objectId: string): string {
  let h = 0;
  for (let i = 0; i < objectId.length; i++) {
    h = (h * 31 + objectId.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

/** Como o valor aparece dentro de uma concatenação ou de um println. */
function valueToString(state: JavaState, value: JavaValue): string {
  switch (value.kind) {
    case "string":
      return value.value;
    case "int":
      return String(value.value);
    case "boolean":
      return String(value.value);
    case "null":
      return "null";
    case "ref": {
      const obj = state.heap[value.objectId];
      if (!obj) return "null";
      const toStringMethod = findMethod(state, obj.className, "toString", 0);
      if (toStringMethod) {
        const result = invoke(state, obj, toStringMethod, []);
        return result ? valueToString(state, result) : "null";
      }
      return `${obj.className}@${identityHash(obj.id)}`;
    }
  }
}

/** Como o jshell imprime o valor no `==>` (String ganha aspas). */
function valueToRepl(state: JavaState, value: JavaValue): string {
  if (value.kind === "string") return `"${value.value}"`;
  return valueToString(state, value);
}

function typeOfValue(state: JavaState, value: JavaValue): string {
  switch (value.kind) {
    case "string":
      return "String";
    case "int":
      return "int";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "ref":
      return state.heap[value.objectId]?.className ?? "Object";
  }
}

// ---------------------------------------------------------------------------
// Avaliação de expressões
// ---------------------------------------------------------------------------

interface Env {
  /** Objeto que recebeu a chamada; ausente quando a expressão vem do REPL. */
  self: JavaObject | null;
  /** Classe onde o método em execução foi declarado — é daqui que `super` sobe. */
  currentClass: string | null;
  locals: Record<string, JavaValue>;
}

function replEnv(): Env {
  return { self: null, currentClass: null, locals: {} };
}

function evalExpr(state: JavaState, src: string, env: Env): JavaValue {
  const expr = src.trim();
  if (!expr) jerror("expressão vazia.");

  // Concatenação / soma no nível de cima.
  const plusParts = splitTopLevel(expr, "+");
  if (plusParts.length > 1 && plusParts.every((p) => p.trim().length > 0)) {
    const values = plusParts.map((p) => evalExpr(state, p, env));
    const anyString = values.some((v) => v.kind === "string");
    if (anyString) {
      return { kind: "string", value: values.map((v) => valueToString(state, v)).join("") };
    }
    let sum = 0;
    for (const v of values) {
      if (v.kind !== "int") {
        jerror(`não dá para somar um valor do tipo ${typeOfValue(state, v)} com '+' aqui.`);
      }
      sum += v.value;
    }
    return { kind: "int", value: sum };
  }

  return evalChain(state, expr, env);
}

function evalChain(state: JavaState, expr: string, env: Env): JavaValue {
  const trimmed = expr.trim();

  if (trimmed.startsWith("(") && findMatching(trimmed, 0) === trimmed.length - 1) {
    return evalExpr(state, trimmed.slice(1, -1), env);
  }

  const segments = splitTopLevel(trimmed, ".").map((s) => s.trim());
  let value: JavaValue;
  let startIndex: number;

  const first = segments[0];

  if (first === "super") {
    if (!env.self || !env.currentClass) {
      jerror("'super' só pode ser usado dentro de um método de uma classe.");
    }
    if (segments.length < 2) jerror("'super' sozinho não é uma expressão. Use super.metodo().");
    const superName = state.types[env.currentClass]?.superName;
    if (!superName) {
      jerror(`${env.currentClass} não estende nenhuma classe, então não há 'super' aqui.`);
    }
    const call = parseCallSegment(segments[1]);
    if (!call) jerror("depois de 'super.' esperava uma chamada de método, ex: super.morfar()");
    const found = findMethod(state, superName, call.name, call.args.length);
    if (!found) {
      jerror(`cannot find symbol: method ${call.name}() em ${superName} (a classe mãe de ${env.currentClass})`);
    }
    const args = call.args.map((a) => evalExpr(state, a, env));
    value = invoke(state, env.self, found, args) ?? { kind: "null" };
    startIndex = 2;
  } else {
    const primary = evalPrimary(state, segments, env);
    value = primary.value;
    startIndex = primary.consumed;
  }

  for (let i = startIndex; i < segments.length; i++) {
    value = applyAccess(state, value, segments[i], env);
  }
  return value;
}

interface Primary {
  value: JavaValue;
  consumed: number;
}

function evalPrimary(state: JavaState, segments: string[], env: Env): Primary {
  const first = segments[0];

  // System.out.println(...) — reconhecido como um bloco só.
  if (first === "System") {
    if (segments[1] === "out" && segments[2]?.startsWith("println")) {
      const call = parseCallSegment(segments[2]);
      if (!call) jerror("uso: System.out.println(algo)");
      const text =
        call.args.length === 0 ? "" : valueToString(state, evalExpr(state, call.args[0], env));
      state.printed.push(text);
      return { value: { kind: "null" }, consumed: 3 };
    }
    jerror(
      "deste 'System' o simulador só entende System.out.println(...) — o println " +
        "imprime e pula uma linha. Confira se você não escreveu 'print' sem o 'ln'."
    );
  }

  if (first.startsWith("new ")) {
    // O `new` vive inteiro no primeiro segmento: splitTopLevel respeita os
    // parênteses, então `new Ranger("a.b").morfar()` já vem separado em dois.
    const call = parseCallSegment(first.slice(4).trim());
    if (!call) jerror("uso: new NomeDaClasse(...) — não esqueça os parênteses.");
    const args = call.args.map((a) => evalExpr(state, a, env));
    return { value: instantiate(state, call.name, args), consumed: 1 };
  }

  if (first === "this") {
    if (!env.self) jerror("'this' só existe dentro de um método ou construtor de uma classe.");
    return { value: { kind: "ref", objectId: env.self.id }, consumed: 1 };
  }

  if (/^".*"$/s.test(first)) {
    return { value: { kind: "string", value: unescapeJava(first.slice(1, -1)) }, consumed: 1 };
  }
  if (/^-?\d+$/.test(first)) {
    return { value: { kind: "int", value: parseInt(first, 10) }, consumed: 1 };
  }
  if (/^-?\d+\.\d+$/.test(first)) {
    jerror("números com casa decimal (double) não fazem parte do subconjunto deste simulador — use int.");
  }
  if (first === "true" || first === "false") {
    return { value: { kind: "boolean", value: first === "true" }, consumed: 1 };
  }
  if (first === "null") {
    return { value: { kind: "null" }, consumed: 1 };
  }

  if (/^'.*'$/s.test(first)) {
    jerror(
      `${first} está entre aspas simples. Em Java, texto vai entre aspas DUPLAS ` +
        `(ex: "Vermelho"); aspas simples servem só para um caractere isolado, como 'A'.`
    );
  }

  // Chamada de método sem receptor: `morfar()` dentro da própria classe.
  const bareCall = parseCallSegment(first);
  if (bareCall) {
    if (state.types[bareCall.name]) {
      jerror(
        `faltou a palavra 'new'. Para construir um objeto da classe ${bareCall.name} ` +
          `escreva: new ${bareCall.name}(${bareCall.args.join(", ")})`
      );
    }
    if (!env.self) {
      jerror(
        `cannot find symbol: method ${bareCall.name}() — no REPL, chame o método a partir de um objeto, ex: ranger.${bareCall.name}()`
      );
    }
    const found = findMethod(state, env.self.className, bareCall.name, bareCall.args.length);
    if (!found) jerror(`cannot find symbol: method ${bareCall.name}()`);
    const args = bareCall.args.map((a) => evalExpr(state, a, env));
    return { value: invoke(state, env.self, found, args) ?? { kind: "null" }, consumed: 1 };
  }

  // Identificador: local/parâmetro, variável do REPL, ou campo de `this`.
  if (first in env.locals) return { value: env.locals[first], consumed: 1 };
  if (env.self) {
    const field = findField(state, env.self.className, first);
    if (field) return { value: env.self.fields[first] ?? defaultValue(field.decl.type), consumed: 1 };
  }
  if (state.vars[first]) return { value: state.vars[first].value, consumed: 1 };

  if (state.types[first]) {
    jerror(
      `'${first}' é o nome de uma ${state.types[first].kind === "class" ? "classe" : "interface"}, não de um objeto. Para criar um objeto use: new ${first}()`
    );
  }
  jerror(`cannot find symbol: variable ${first}`);
}

function applyAccess(state: JavaState, target: JavaValue, segment: string, env: Env): JavaValue {
  if (target.kind === "null") {
    jerror(
      "java.lang.NullPointerException — a variável ainda não aponta para nenhum objeto (ela vale null)."
    );
  }
  if (target.kind !== "ref") {
    jerror(`não é possível acessar '${segment}' em um valor do tipo ${typeOfValue(state, target)}.`);
  }
  const obj = state.heap[target.objectId];
  if (!obj) jerror("java.lang.NullPointerException");

  const call = parseCallSegment(segment);
  if (call) {
    const found = findMethod(state, obj.className, call.name, call.args.length);
    if (!found) {
      const declared = declaredInInterface(state, obj.className, call.name);
      if (declared) {
        jerror(
          `${obj.className} implementa ${declared} mas não escreveu o método ${call.name}() — uma interface obriga quem a implementa a escrever todos os métodos dela.`
        );
      }
      const disponiveis = classChain(state, obj.className)
        .flatMap((d) => d.methods.filter((m) => !m.abstract).map((m) => `${m.name}()`))
        .join(", ");
      jerror(
        `a classe ${obj.className} não tem um método chamado ${call.name}(). ` +
          (disponiveis
            ? `Os métodos que ela tem são: ${disponiveis}.`
            : `Ela ainda não declara nenhum método.`)
      );
    }
    if (found.decl.visibility === "private" && env.currentClass !== found.ownerClass) {
      jerror(`${call.name}() has private access in ${found.ownerClass}`);
    }
    const args = call.args.map((a) => evalExpr(state, a, env));
    return invoke(state, obj, found, args) ?? { kind: "null" };
  }

  const field = findField(state, obj.className, segment);
  if (!field) jerror(`cannot find symbol: variable ${segment} na classe ${obj.className}`);
  if (field.decl.visibility === "private" && env.currentClass !== field.ownerClass) {
    jerror(
      `${segment} has private access in ${field.ownerClass} — um campo private só pode ser lido de dentro da própria classe. É para isso que existe um método getter.`
    );
  }
  return obj.fields[segment] ?? defaultValue(field.decl.type);
}

function declaredInInterface(state: JavaState, className: string, methodName: string): string | null {
  for (const name of allInterfaces(state, className)) {
    const decl = state.types[name];
    if (decl?.methods.some((m) => m.name === methodName)) return name;
  }
  return null;
}

interface CallSegment {
  name: string;
  args: string[];
}

/** Lê `nome(arg1, arg2)`; devolve null se o segmento não for uma chamada. */
function parseCallSegment(segment: string): CallSegment | null {
  const trimmed = segment.trim();
  const parenIdx = trimmed.indexOf("(");
  if (parenIdx === -1) return null;
  if (findMatching(trimmed, parenIdx) !== trimmed.length - 1) return null;
  const name = trimmed.slice(0, parenIdx).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null;
  const inner = trimmed.slice(parenIdx + 1, -1).trim();
  const args = inner ? splitTopLevel(inner, ",").map((a) => a.trim()) : [];
  return { name, args };
}

function unescapeJava(src: string): string {
  return src.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

// ---------------------------------------------------------------------------
// Criação de objetos e chamada de métodos
// ---------------------------------------------------------------------------

function instantiate(state: JavaState, className: string, args: JavaValue[]): JavaValue {
  const decl = state.types[className];
  if (!decl) {
    jerror(`cannot find symbol: class ${className} — declare a classe antes de criar um objeto dela.`);
  }
  if (decl.kind === "interface") {
    jerror(
      `${className} is abstract; cannot be instantiated — uma interface não vira objeto. Crie um objeto de uma classe que a implementa.`
    );
  }

  state.objectCounter++;
  const obj: JavaObject = {
    id: `obj${state.objectCounter}`,
    className,
    fields: {},
  };
  state.heap[obj.id] = obj;

  // Campos de toda a cadeia, da mãe para a filha (a mãe inicializa primeiro).
  const chain = classChain(state, className).slice().reverse();
  for (const c of chain) {
    for (const f of c.fields) {
      obj.fields[f.name] = defaultValue(f.type);
    }
  }
  for (const c of chain) {
    for (const f of c.fields) {
      if (f.initializer) {
        obj.fields[f.name] = evalExpr(state, f.initializer, {
          self: obj,
          currentClass: c.name,
          locals: {},
        });
      }
    }
  }

  runConstructor(state, obj, className, args);
  return { kind: "ref", objectId: obj.id };
}

function runConstructor(state: JavaState, obj: JavaObject, className: string, args: JavaValue[]): void {
  const decl = state.types[className];
  if (!decl) return;
  const ctor = decl.constructor;

  if (!ctor) {
    if (args.length > 0) {
      jerror(
        `constructor ${className} in class ${className} cannot be applied to given types — ${className} não declara construtor, então só aceita 'new ${className}()' sem argumentos.`
      );
    }
    // Construtor padrão: sobe para a mãe sem argumentos.
    if (decl.superName && state.types[decl.superName]) {
      runConstructor(state, obj, decl.superName, []);
    }
    return;
  }

  if (ctor.params.length !== args.length) {
    jerror(
      `constructor ${className} in class ${className} cannot be applied to given types — ele espera ${ctor.params.length} argumento(s) e recebeu ${args.length}.`
    );
  }

  const locals: Record<string, JavaValue> = {};
  ctor.params.forEach((p, i) => {
    locals[p.name] = args[i];
  });
  const env: Env = { self: obj, currentClass: className, locals };

  const statements = ctor.body.slice();
  const firstStatement = statements[0]?.trim() ?? "";
  const superCall = parseCallSegment(firstStatement);
  if (superCall && superCall.name === "super") {
    statements.shift();
    const superArgs = superCall.args.map((a) => evalExpr(state, a, env));
    if (!decl.superName) {
      jerror(`${className} não estende nenhuma classe, então não pode chamar super(...).`);
    }
    runConstructor(state, obj, decl.superName, superArgs);
  } else if (decl.superName && state.types[decl.superName]) {
    const superCtor = state.types[decl.superName].constructor;
    if (superCtor && superCtor.params.length > 0) {
      jerror(
        `constructor ${decl.superName} in class ${decl.superName} cannot be applied to given types — a classe mãe exige ${superCtor.params.length} argumento(s), então o construtor de ${className} precisa começar chamando super(...).`
      );
    }
    runConstructor(state, obj, decl.superName, []);
  }

  for (const statement of statements) {
    execStatement(state, statement, env);
  }
}

/** Executa um método; devolve o valor do `return`, ou null se for void. */
function invoke(state: JavaState, obj: JavaObject, found: FoundMethod, args: JavaValue[]): JavaValue | null {
  const locals: Record<string, JavaValue> = {};
  found.decl.params.forEach((p, i) => {
    locals[p.name] = args[i] ?? defaultValue(p.type);
  });
  const env: Env = { self: obj, currentClass: found.ownerClass, locals };

  for (const statement of found.decl.body) {
    const returned = execStatement(state, statement, env);
    if (returned !== undefined) return returned;
  }
  return null;
}

/**
 * Executa um statement de corpo de método. Devolve `undefined` quando a
 * execução deve continuar, ou o valor retornado quando bateu num `return`.
 */
function execStatement(state: JavaState, rawStatement: string, env: Env): JavaValue | undefined {
  const statement = rawStatement.trim().replace(/;$/, "").trim();
  if (!statement) return undefined;

  rejectUnsupported(statement);

  if (statement === "return") return { kind: "null" };
  if (statement.startsWith("return ")) {
    return evalExpr(state, statement.slice("return ".length), env);
  }

  // Atribuição: `this.campo = expr`, `campo = expr`, `local = expr`.
  const eqParts = splitTopLevel(statement, "=");
  const isAssignment =
    eqParts.length === 2 && !/[=!<>]$/.test(eqParts[0].trim()) && !eqParts[1].trim().startsWith("=");
  if (isAssignment) {
    const targetSrc = eqParts[0].trim();
    const value = evalExpr(state, eqParts[1], env);
    assignTo(state, targetSrc, value, env);
    return undefined;
  }

  evalExpr(state, statement, env);
  return undefined;
}

function assignTo(state: JavaState, targetSrc: string, value: JavaValue, env: Env): void {
  const target = targetSrc.trim();

  // Declaração de variável local: `Tipo nome = ...`
  const words = target.split(/\s+/).filter(Boolean);
  if (words.length === 2 && !target.includes(".")) {
    env.locals[words[1]] = value;
    return;
  }

  if (target.startsWith("this.")) {
    const fieldName = target.slice("this.".length).trim();
    if (!env.self) jerror("'this' só existe dentro de um método ou construtor.");
    const field = findField(state, env.self.className, fieldName);
    if (!field) {
      jerror(
        `cannot find symbol: variable ${fieldName} — declare o campo na classe antes de atribuir: ${typeOfValue(state, value)} ${fieldName};`
      );
    }
    env.self.fields[fieldName] = value;
    return;
  }

  const segments = splitTopLevel(target, ".").map((s) => s.trim());
  if (segments.length === 1) {
    const name = segments[0];
    if (name in env.locals) {
      env.locals[name] = value;
      return;
    }
    if (env.self) {
      const field = findField(state, env.self.className, name);
      if (field) {
        env.self.fields[name] = value;
        return;
      }
    }
    if (state.vars[name]) {
      state.vars[name].value = value;
      return;
    }
    jerror(`cannot find symbol: variable ${name}`);
  }

  // `obj.campo = valor`
  const objValue = evalExpr(state, segments.slice(0, -1).join("."), env);
  const fieldName = segments[segments.length - 1];
  if (objValue.kind !== "ref") jerror(`não é possível atribuir a '${target}'.`);
  const obj = state.heap[objValue.objectId];
  const field = findField(state, obj.className, fieldName);
  if (!field) jerror(`cannot find symbol: variable ${fieldName} na classe ${obj.className}`);
  if (field.decl.visibility === "private" && env.currentClass !== field.ownerClass) {
    jerror(
      `${fieldName} has private access in ${field.ownerClass} — para mudar um campo private de fora, a classe precisa oferecer um método (setter).`
    );
  }
  obj.fields[fieldName] = value;
}

function rejectUnsupported(src: string): void {
  const firstWord = src.trim().split(/[\s({]/)[0];
  const reason = UNSUPPORTED_KEYWORDS[firstWord];
  if (reason) {
    jerror(
      `'${firstWord}' é Java válido, mas ${reason} está fora do subconjunto deste simulador — a trilha é sobre orientação a objetos.`
    );
  }
}

// ---------------------------------------------------------------------------
// Entrada do REPL
// ---------------------------------------------------------------------------

/**
 * Tira comentários do código antes de qualquer parsing, preservando as quebras
 * de linha (elas separam trechos). Comentar o código é natural para quem está
 * aprendendo, e o parser não deveria engasgar com isso.
 */
function stripComments(src: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      out += c;
      if (c === "\\" && i + 1 < src.length) out += src[++i];
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") out += "\n";
        i++;
      }
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

/** A linha continua na próxima? (termina em operador ou abre-parêntese) */
function isContinuation(buf: string): boolean {
  return /[=+\-*/,.&|(]$/.test(buf.trimEnd());
}

/**
 * Quebra um texto de várias linhas nos trechos independentes que o jshell
 * chama de "snippets": uma declaração de classe (que acaba na chave que a
 * fecha), um statement (que acaba no ponto e vírgula) ou uma expressão solta
 * numa linha. É o que permite a pessoa escrever a classe inteira no editor,
 * indentada como se escreve Java de verdade, e mandar tudo de uma vez.
 */
export function splitSnippets(src: string): string[] {
  const snippets: string[] = [];
  const push = (buf: string) => {
    if (buf.trim()) snippets.push(buf.trim());
  };

  let depth = 0;
  let inString = false;
  let buf = "";

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      buf += c;
      if (c === "\\" && i + 1 < src.length) buf += src[++i];
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      buf += c;
    } else if (c === "{" || c === "(") {
      depth++;
      buf += c;
    } else if (c === "}" || c === ")") {
      depth--;
      buf += c;
      if (depth <= 0 && c === "}") {
        push(buf);
        buf = "";
        depth = 0;
      }
    } else if (c === ";" && depth === 0) {
      buf += c;
      push(buf);
      buf = "";
    } else if (c === "\n" && depth === 0) {
      if (buf.trim() && !isContinuation(buf)) {
        push(buf);
        buf = "";
      } else {
        buf += c;
      }
    } else {
      buf += c;
    }
  }
  push(buf);
  return snippets;
}

/**
 * Executa um texto que pode ter várias linhas. Um trecho só segue o caminho
 * de sempre; vários são executados em ordem, acumulando a saída. Se um falha,
 * para ali — e os anteriores continuam valendo, exatamente como acontece numa
 * sessão de verdade do jshell, onde o que já rodou não se desfaz.
 */
export function runCommand(rawInput: string, prev: JavaState): JavaCommandResult {
  const input = stripComments(rawInput).trim();
  if (!input) {
    // Silêncio é a pior resposta para quem está começando: sem isto, clicar
    // em Executar com o esqueleto de comentários do desafio não devolvia nada.
    if (rawInput.trim()) {
      return fail(
        prev,
        "|  Aqui só tem comentário. Comentário é uma nota para humanos — o Java",
        "|  ignora tudo depois de // e não executa nada. Escreva o código de verdade."
      );
    }
    return fail(prev, "");
  }

  const snippets = splitSnippets(input);
  if (snippets.length <= 1) return runSnippet(snippets[0] ?? input, prev);

  let state = prev;
  const output: string[] = [];
  const unlockedCommands: string[] = [];

  for (const snippet of snippets) {
    const result = runSnippet(snippet, state);
    state = result.state;
    if (result.unlockedCommand) unlockedCommands.push(result.unlockedCommand);
    output.push(...result.output.filter((line) => line.length > 0));

    if (!result.ok) {
      output.push(`|  parou em: ${snippet.replace(/\s+/g, " ").slice(0, 60)}`);
      output.push("|  as linhas anteriores já foram executadas e continuam valendo.");
      return { ok: false, output, state, unlockedCommands };
    }
  }

  return { ok: true, output, state, unlockedCommands };
}

function runSnippet(rawInput: string, prev: JavaState): JavaCommandResult {
  const input = rawInput.trim();
  if (!input) return fail(prev, "");

  const state = clone(prev);

  let result: JavaCommandResult;
  try {
    result = state.jshellStarted ? handleRepl(input, state) : handleShell(input, state);
  } catch (e) {
    if (e instanceof JavaError) {
      return fail(state, `|  Erro: ${e.message}`);
    }
    throw e;
  }

  if (result.ok && result.unlockedCommand) {
    result.state.lastCommand = result.unlockedCommand;
  }
  return result;
}

function handleShell(input: string, state: JavaState): JavaCommandResult {
  const tokens = input.split(/\s+/);

  if (tokens[0] === "java" && (tokens[1] === "--version" || tokens[1] === "-version")) {
    return ok(state, ["openjdk 21.0.2 2024-01-16", "OpenJDK Runtime Environment (build 21.0.2+13-58)"], "java --version");
  }

  if (tokens[0] !== "jshell") {
    return fail(
      state,
      `comando não reconhecido: ${tokens[0]}`,
      "dica: fora do REPL, abra o Java digitando 'jshell'."
    );
  }

  state.jshellStarted = true;
  return ok(
    state,
    [
      "|  Welcome to JShell -- Version 21.0.2",
      "|  For an introduction type: /help intro",
      "",
      "Daqui pra frente você digita Java de verdade, sem prefixo nenhum.",
    ],
    "jshell"
  );
}

/** Palavras-chave do Java; usadas só para detectar erro de maiúscula. */
const CASE_SENSITIVE_KEYWORDS = [
  "class",
  "interface",
  "extends",
  "implements",
  "new",
  "public",
  "private",
  "protected",
  "static",
  "void",
  "return",
  "this",
  "super",
  "int",
  "boolean",
  "true",
  "false",
  "null",
];

function handleRepl(input: string, state: JavaState): JavaCommandResult {
  if (input.startsWith("/")) return handleMetaCommand(input, state);

  const withoutSemicolon = input.replace(/;$/, "").trim();
  const firstWord = input.split(/[\s({]/)[0];

  // Java diferencia maiúscula de minúscula, e escrever "Class" é um tropeço
  // clássico de quem vem de outra linguagem ou copiou de um slide.
  const certo = CASE_SENSITIVE_KEYWORDS.find(
    (k) => k.toLowerCase() === firstWord.toLowerCase() && k !== firstWord
  );
  if (certo) {
    return fail(
      state,
      `|  Erro: '${firstWord}' está com a caixa errada. Java diferencia maiúsculas de`,
      `|  minúsculas: a palavra-chave é '${certo}', tudo em minúsculo.`
    );
  }

  // Quem copia de tutorial traz o main junto; no jshell ele não faz falta.
  if (/\bstatic\s+void\s+main\s*\(/.test(input)) {
    return fail(
      state,
      "|  Erro: aqui você não precisa de 'public static void main'. Num arquivo .java",
      "|  o main é o ponto de partida do programa, mas o jshell executa cada linha",
      "|  direto — escreva só os comandos, sem o main e sem uma classe em volta."
    );
  }

  if (firstWord === "class" || firstWord === "interface") {
    return declareType(input, state, firstWord);
  }
  if (firstWord === "public" || firstWord === "abstract" || firstWord === "final") {
    const stripped = stripModifiers(input);
    const nextWord = stripped.rest.split(/[\s({]/)[0];
    if (nextWord === "class" || nextWord === "interface") {
      return declareType(stripped.rest, state, nextWord);
    }
  }

  rejectUnsupported(input);

  // Declaração de variável: `Tipo nome = expressão` (ou `var nome = ...`).
  const eqParts = splitTopLevel(withoutSemicolon, "=");
  if (eqParts.length >= 2) {
    const left = eqParts[0].trim();
    const rightSrc = eqParts.slice(1).join("=");
    const words = left.split(/\s+/).filter(Boolean);

    if (words.length === 2) {
      const [declaredTypeRaw, name] = words;
      const printedBefore = state.printed.length;
      const value = evalExpr(state, rightSrc, replEnv());
      const printedLines = state.printed.slice(printedBefore);
      const declaredType = declaredTypeRaw === "var" ? typeOfValue(state, value) : declaredTypeRaw;

      if (declaredTypeRaw !== "var" && value.kind === "ref") {
        const actual = state.heap[value.objectId].className;
        if (state.types[declaredType] && !isSubtype(state, actual, declaredType)) {
          return fail(
            state,
            `|  Erro: incompatible types: ${actual} cannot be converted to ${declaredType} — ${actual} não é um ${declaredType}.`
          );
        }
      }

      if (!state.vars[name]) state.varOrder.push(name);
      state.vars[name] = { name, declaredType, value };
      return ok(
        state,
        [...printedLines, `${name} ==> ${valueToRepl(state, value)}`],
        value.kind === "ref" ? "new" : undefined
      );
    }

    if (words.length === 1) {
      const printedBefore = state.printed.length;
      const value = evalExpr(state, rightSrc, replEnv());
      const printedLines = state.printed.slice(printedBefore);
      assignTo(state, left, value, replEnv());
      return ok(state, [...printedLines, `${left} ==> ${valueToRepl(state, value)}`]);
    }
  }

  // Expressão ou chamada solta.
  const before = state.printed.length;
  const value = evalExpr(state, withoutSemicolon, replEnv());
  const printedLines = state.printed.slice(before);

  // `System.out.println(...)` e métodos void não produzem valor no jshell.
  const isVoid = value.kind === "null" && (printedLines.length > 0 || isVoidCall(state, withoutSemicolon));
  const lines = [...printedLines];
  if (!isVoid) {
    state.scratchCounter++;
    lines.push(`$${state.scratchCounter} ==> ${valueToRepl(state, value)}`);
  }

  return ok(state, lines.length > 0 ? lines : ["|  (sem saída)"], unlockedFor(withoutSemicolon));
}

/** Um método void não imprime `$n ==>` no jshell; descobre se a chamada era void. */
function isVoidCall(state: JavaState, src: string): boolean {
  const segments = splitTopLevel(src, ".").map((s) => s.trim());
  const last = parseCallSegment(segments[segments.length - 1] ?? "");
  if (!last) return false;
  if (segments[0] === "System") return true;
  const receiver = state.vars[segments[0]];
  if (!receiver || receiver.value.kind !== "ref") return false;
  const obj = state.heap[receiver.value.objectId];
  if (!obj) return false;
  const found = findMethod(state, obj.className, last.name, last.args.length);
  return found?.decl.returnType === "void";
}

function unlockedFor(src: string): string | undefined {
  if (src.includes("System.out.println")) return "System.out.println";
  if (src.startsWith("new ")) return "new";
  return undefined;
}

function declareType(src: string, state: JavaState, kind: "class" | "interface"): JavaCommandResult {
  const decl = parseTypeDeclaration(src, kind);

  if (decl.superName && !state.types[decl.superName]) {
    return fail(
      state,
      `|  Erro: cannot find symbol: class ${decl.superName} — declare a classe mãe antes de estender ela.`
    );
  }
  for (const name of decl.interfaces) {
    const target = state.types[name];
    if (!target) {
      return fail(state, `|  Erro: cannot find symbol: interface ${name} — declare a interface antes de implementá-la.`);
    }
    if (target.kind !== "interface") {
      return fail(state, `|  Erro: ${name} é uma classe, não uma interface. Para herdar de uma classe use 'extends'.`);
    }
  }

  const replacing = Boolean(state.types[decl.name]);
  state.types[decl.name] = decl;
  if (!replacing) state.typeOrder.push(decl.name);

  const lines = [
    replacing
      ? `|  replaced ${kind === "class" ? "class" : "interface"} ${decl.name}`
      : `|  created ${kind === "class" ? "class" : "interface"} ${decl.name}`,
  ];

  // Aviso (não erro) quando a classe promete uma interface e não cumpre.
  for (const name of decl.interfaces) {
    const missing = (state.types[name]?.methods ?? []).filter(
      (m) => !findMethod(state, decl.name, m.name, m.params.length)
    );
    if (missing.length > 0) {
      lines.push(
        `|  atenção: ${decl.name} implementa ${name} mas ainda não escreveu: ${missing
          .map((m) => `${m.name}()`)
          .join(", ")}`
      );
    }
  }

  return ok(state, lines, conceptTaughtBy(decl));
}

/**
 * Qual verbete do dicionário esta declaração ensina. Uma declaração costuma
 * exercitar vários conceitos ao mesmo tempo (uma filha com construtor e campo
 * private), e só um verbete pode ser desbloqueado por comando — então a ordem
 * abaixo vai do conceito mais avançado para o mais básico, para creditar o que
 * a pessoa acabou de aprender e não o que ela já sabia.
 */
function conceptTaughtBy(decl: JavaTypeDecl): string {
  const bodies = [...decl.methods.flatMap((m) => m.body), ...(decl.constructor?.body ?? [])];
  const usa = (trecho: string) => bodies.some((linha) => linha.includes(trecho));

  if (decl.methods.some((m) => m.hasOverrideAnnotation)) return "@Override";
  if (usa("super")) return "super";
  if (decl.superName) return "extends";
  if (decl.interfaces.length > 0) return "implements";
  if (decl.constructor) return "construtor";
  if (decl.fields.some((f) => f.visibility === "private")) return "private";
  if (usa("this.")) return "this";
  return decl.kind === "class" ? "class" : "interface";
}

function handleMetaCommand(input: string, state: JavaState): JavaCommandResult {
  const [command] = input.split(/\s+/);

  switch (command) {
    case "/vars": {
      if (state.varOrder.length === 0) return ok(state, ["|  Não há variáveis nesta sessão."], "/vars");
      const lines = state.varOrder.map((name) => {
        const v = state.vars[name];
        return `|    ${v.declaredType} ${v.name} = ${valueToRepl(state, v.value)}`;
      });
      return ok(state, lines, "/vars");
    }
    case "/types": {
      if (state.typeOrder.length === 0) return ok(state, ["|  Não há tipos nesta sessão."], "/types");
      const lines = state.typeOrder.map((name) => {
        const t = state.types[name];
        const extra = [
          t.superName ? `extends ${t.superName}` : "",
          t.interfaces.length > 0 ? `implements ${t.interfaces.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `|    ${t.kind} ${t.name}${extra ? " " + extra : ""}`;
      });
      return ok(state, lines, "/types");
    }
    case "/methods": {
      const lines: string[] = [];
      for (const name of state.typeOrder) {
        for (const m of state.types[name].methods) {
          lines.push(`|    ${m.returnType} ${name}.${m.name}(${m.params.map((p) => p.type).join(", ")})`);
        }
      }
      return ok(state, lines.length > 0 ? lines : ["|  Não há métodos nesta sessão."], "/methods");
    }
    case "/exit":
      state.jshellStarted = false;
      return ok(state, ["|  Goodbye"], "/exit");
    case "/help":
      return ok(
        state,
        [
          "|  /vars     mostra as variáveis da sessão",
          "|  /types    mostra as classes e interfaces declaradas",
          "|  /methods  mostra os métodos declarados",
          "|  /exit     fecha o jshell",
        ],
        "/help"
      );
    default:
      return fail(state, `|  Erro: comando do jshell não reconhecido: ${command}. Tente /help.`);
  }
}
