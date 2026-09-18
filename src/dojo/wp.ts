import type { Dojo } from "./types";
import type { WpState } from "../engine/wp/types";
import { createInitialWpState } from "../engine/wp/types";
import { runCommand } from "../engine/wp/commands";
import { WP_CHALLENGES, WP_TRILHAS_ORDER } from "../data/wpChallenges";
import { WP_DICTIONARY } from "../data/wpDictionary";
import WpStatus from "../components/WpStatus";

export const wpDojo: Dojo<WpState> = {
  domainSlug: "wp-cli",
  label: "WP-CLI",
  commandPrefix: "wp",
  trilhasOrder: WP_TRILHAS_ORDER,
  runCommand,
  createInitialState: createInitialWpState,
  challenges: WP_CHALLENGES,
  dictionary: WP_DICTIONARY,
  Visualization: WpStatus,
  preface: {
    title: "Antes de começar: instale o wp-cli de verdade",
    intro: [
      "Os desafios abaixo simulam o wp-cli — não precisa instalar nada para praticar aqui.",
      "Mas se quiser usar de verdade no seu terminal, os passos são:",
    ],
    steps: [
      "curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar",
      "php wp-cli.phar --info   # confere se baixou certo",
      "chmod +x wp-cli.phar",
      "sudo mv wp-cli.phar /usr/local/bin/wp",
      "wp --info   # se aparecer a versão, está pronto",
    ],
  },
};
