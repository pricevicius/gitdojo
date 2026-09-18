#!/usr/bin/env node
// Gera o esqueleto de um dojo novo (engine, dados, dojo, visualização) e o
// registra em src/dojo/registry.ts. Ver "Criando um dojo novo" no README.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const SRC = path.join(ROOT, "src");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    args[key] = value;
    i++;
  }
  return args;
}

function fail(message) {
  console.error(`\nErro: ${message}\n`);
  process.exit(1);
}

function toPascalCase(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function writeIfAbsent(filePath, content) {
  if (existsSync(filePath)) {
    fail(`${path.relative(ROOT, filePath)} já existe — apague-o antes de rodar o gerador de novo, ou escolha outro --slug.`);
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  console.log(`  criado  ${path.relative(ROOT, filePath)}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = args.slug;
  const subdomain = args.subdomain ?? slug;
  const label = args.label ?? (slug ? toPascalCase(slug) : undefined);
  const prefix = args.prefix ?? slug;

  if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
    fail("--slug é obrigatório e deve ser kebab-case minúsculo, ex: --slug docker");
  }

  const registryPath = path.join(SRC, "dojo", "registry.ts");
  const registrySrc = readFileSync(registryPath, "utf8");
  if (registrySrc.includes(`domainSlug: "${slug}"`) || registrySrc.includes(`"./${slug}"`)) {
    fail(`já existe um dojo com slug "${slug}" (ver src/dojo/registry.ts).`);
  }
  if (registrySrc.includes(`subdomain: "${subdomain}"`)) {
    fail(`já existe um dojo com subdomain "${subdomain}".`);
  }

  const Slug = toPascalCase(slug);
  const stateType = `${Slug}State`;
  const resultType = `${Slug}CommandResult`;
  const createInitial = `createInitial${Slug}State`;

  // --- src/engine/<slug>/types.ts ---
  writeIfAbsent(
    path.join(SRC, "engine", slug, "types.ts"),
    `export interface ${stateType} {
  lastCommand: string | null;
  // TODO: modele aqui o estado real da ferramenta (o que muda a cada comando).
}

export interface ${resultType} {
  ok: boolean;
  output: string[];
  state: ${stateType};
  unlockedCommand?: string;
}

export function ${createInitial}(): ${stateType} {
  return {
    lastCommand: null,
  };
}
`,
  );

  // --- src/engine/<slug>/commands.ts ---
  writeIfAbsent(
    path.join(SRC, "engine", slug, "commands.ts"),
    `import type { ${resultType}, ${stateType} } from "./types";

function clone(state: ${stateType}): ${stateType} {
  return JSON.parse(JSON.stringify(state)) as ${stateType};
}

function fail(state: ${stateType}, ...lines: string[]): ${resultType} {
  return { ok: false, output: lines, state };
}

function ok(state: ${stateType}, lines: string[], unlockedCommand?: string): ${resultType} {
  return { ok: true, output: lines, state, unlockedCommand };
}

export function runCommand(rawInput: string, prev: ${stateType}): ${resultType} {
  const input = rawInput.trim();
  if (!input) return fail(prev, "");

  const tokens = input.split(/\\s+/);
  if (tokens[0] !== "${prefix}") {
    return fail(prev, \`comando não reconhecido: \${tokens[0]}\`, "dica: todo comando começa com '${prefix}'");
  }

  const state = clone(prev);
  const sub = tokens[1];

  switch (sub) {
    // TODO: implemente os subcomandos reais da ferramenta aqui.
    case "version":
      return ok(state, ["0.0.0"], "${prefix} version");
    default:
      return fail(state, \`${prefix}: '\${sub}' não é um comando suportado neste simulador ainda.\`);
  }
}
`,
  );

  // --- src/data/<slug>Challenges.ts ---
  writeIfAbsent(
    path.join(SRC, "data", `${slug}Challenges.ts`),
    `import type { ${stateType} } from "../engine/${slug}/types";
import { ${createInitial} } from "../engine/${slug}/types";
import type { DojoChallenge } from "../dojo/types";

export type ${Slug}Challenge = DojoChallenge<${stateType}>;

export const ${slug.toUpperCase().replace(/-/g, "_")}_TRILHAS_ORDER = ["Fundamentos"] as const;

export const ${slug.toUpperCase().replace(/-/g, "_")}_CHALLENGES: ${Slug}Challenge[] = [
  {
    id: "version-1",
    trilha: "Fundamentos",
    title: "TODO: título do primeiro desafio",
    description: "TODO: descreva o cenário que a pessoa precisa resolver.",
    hint: "TODO: uma dica que não entregue a resposta.",
    setup: () => ${createInitial}(),
    goal: (s) => s.lastCommand === "version",
  },
  // TODO: adicione o restante dos desafios da trilha.
];
`,
  );

  // --- src/data/<slug>Dictionary.ts ---
  writeIfAbsent(
    path.join(SRC, "data", `${slug}Dictionary.ts`),
    `import type { DictionaryEntry } from "../dojo/types";

export const ${slug.toUpperCase().replace(/-/g, "_")}_DICTIONARY: Record<string, DictionaryEntry> = {
  "${prefix} version": {
    command: "${prefix} version",
    category: "Fundamentos",
    short: "TODO: explique o que o comando faz.",
    example: "${prefix} version",
  },
  // TODO: um verbete por comando desbloqueável (unlockedCommand em commands.ts).
};
`,
  );

  // --- src/components/<Slug>Visualization.tsx ---
  writeIfAbsent(
    path.join(SRC, "components", `${Slug}Visualization.tsx`),
    `import type { ${stateType} } from "../engine/${slug}/types";

interface Props {
  state: ${stateType};
}

// TODO: substitua por uma visualização de verdade do estado da ferramenta
// (ver Graph.tsx e WpStatus.tsx como referência de dois estilos diferentes).
export default function ${Slug}Visualization({ state }: Props) {
  return <pre>{JSON.stringify(state, null, 2)}</pre>;
}
`,
  );

  // --- src/dojo/<slug>.ts ---
  writeIfAbsent(
    path.join(SRC, "dojo", `${slug}.ts`),
    `import type { Dojo } from "./types";
import type { ${stateType} } from "../engine/${slug}/types";
import { ${createInitial} } from "../engine/${slug}/types";
import { runCommand } from "../engine/${slug}/commands";
import { ${slug.toUpperCase().replace(/-/g, "_")}_CHALLENGES, ${slug.toUpperCase().replace(/-/g, "_")}_TRILHAS_ORDER } from "../data/${slug}Challenges";
import { ${slug.toUpperCase().replace(/-/g, "_")}_DICTIONARY } from "../data/${slug}Dictionary";
import ${Slug}Visualization from "../components/${Slug}Visualization";

export const ${slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Dojo: Dojo<${stateType}> = {
  domainSlug: "${slug}",
  subdomain: "${subdomain}",
  label: "${label}",
  commandPrefix: "${prefix}",
  trilhasOrder: ${slug.toUpperCase().replace(/-/g, "_")}_TRILHAS_ORDER,
  runCommand,
  createInitialState: ${createInitial},
  challenges: ${slug.toUpperCase().replace(/-/g, "_")}_CHALLENGES,
  dictionary: ${slug.toUpperCase().replace(/-/g, "_")}_DICTIONARY,
  Visualization: ${Slug}Visualization,
};
`,
  );

  // --- registra em src/dojo/registry.ts ---
  const dojoVarName = `${slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Dojo`;
  const importLine = `import { ${dojoVarName} } from "./${slug}";\n`;
  const lastImportMatch = [...registrySrc.matchAll(/^import .+\n/gm)].pop();
  const insertAt = lastImportMatch.index + lastImportMatch[0].length;
  let patched = registrySrc.slice(0, insertAt) + importLine + registrySrc.slice(insertAt);
  patched = patched.replace(
    /export const DOJOS: AnyDojo\[\] = \[([^\]]*)\];/,
    (_, inner) => `export const DOJOS: AnyDojo[] = [${inner.trim()}, ${dojoVarName}];`,
  );
  writeFileSync(registryPath, patched);
  console.log(`  editado ${path.relative(ROOT, registryPath)}`);

  console.log(`
Dojo "${slug}" criado. Falta:
  1. Implementar os comandos reais em src/engine/${slug}/commands.ts
  2. Escrever os desafios de verdade em src/data/${slug}Challenges.ts
  3. Completar o dicionário em src/data/${slug}Dictionary.ts
  4. Trocar a visualização stub em src/components/${Slug}Visualization.tsx
  5. Rodar "npm run test" e "npx tsc --noEmit" antes de abrir a PR

Roteamento por subdomínio (${subdomain}.odojo.com.br) e DNS são passos de infra
feitos por um mantenedor depois do merge — não é preciso resolver isso na PR.
`);
}

main();
