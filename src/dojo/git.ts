import type { Dojo } from "./types";
import type { RepoState } from "../engine/types";
import { createInitialState } from "../engine/types";
import { runCommand } from "../engine/commands";
import { CHALLENGES, TRILHAS_ORDER } from "../data/challenges";
import { DICTIONARY } from "../data/dictionary";
import Graph from "../components/Graph";

export const gitDojo: Dojo<RepoState> = {
  domainSlug: "git",
  subdomain: "git",
  label: "Git",
  commandPrefix: "git",
  trilhasOrder: TRILHAS_ORDER,
  runCommand,
  createInitialState,
  challenges: CHALLENGES,
  dictionary: DICTIONARY,
  Visualization: Graph,
};
