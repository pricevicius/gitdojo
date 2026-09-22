import type { Dojo } from "./types";
import type { JavaState } from "../engine/java/types";
import { createInitialJavaState } from "../engine/java/types";
import { runCommand } from "../engine/java/commands";
import { JAVA_CHALLENGES, JAVA_TRILHAS_ORDER } from "../data/javaChallenges";
import { JAVA_DICTIONARY } from "../data/javaDictionary";
import JavaVisualization from "../components/JavaVisualization";

export const javaDojo: Dojo<JavaState> = {
  domainSlug: "java",
  subdomain: "java",
  label: "Java OOP",
  tagline: "Orientação a objetos explicada com Power Rangers — porque classe, herança e polimorfismo são exatamente isso.",
  commandPrefix: "jshell",
  // O que se digita aqui é código, não um comando curto: escrever uma classe
  // inteira numa linha só seria hostil justamente para quem nunca programou.
  inputMode: "editor",
  contributor: { name: "Eduardo Silva", url: "https://github.com/eduardonk9999" },
  trilhasOrder: JAVA_TRILHAS_ORDER,
  runCommand,
  createInitialState: createInitialJavaState,
  challenges: JAVA_CHALLENGES,
  dictionary: JAVA_DICTIONARY,
  Visualization: JavaVisualization,
  preface: {
    title: "Antes de começar: instale o Java de verdade",
    intro: [
      "Os desafios simulam o jshell, o terminal interativo do Java — não precisa instalar nada para praticar aqui.",
      "Mas tudo que você digitar nesta trilha é Java real e roda igual na sua máquina. Para ter o jshell de verdade:",
    ],
    steps: [
      "# macOS (Homebrew)",
      "brew install openjdk",
      "# Ubuntu/Debian",
      "sudo apt install default-jdk",
      "java --version   # precisa ser 9 ou maior; o jshell não existe antes disso",
      "jshell           # abre o terminal interativo do Java",
    ],
  },
};
