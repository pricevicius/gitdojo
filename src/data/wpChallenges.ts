import type { WpState } from "../engine/wp/types";
import { createInitialWpState } from "../engine/wp/types";
import type { DojoChallenge } from "../dojo/types";

export type WpChallenge = DojoChallenge<WpState>;

const WP_TRILHAS_ORDER = ["Fundamentos"] as const;
export { WP_TRILHAS_ORDER };

function withDownloaded(): WpState {
  const s = createInitialWpState();
  s.downloaded = true;
  return s;
}

function withConfigured(): WpState {
  const s = withDownloaded();
  s.config = { dbName: "meusite", dbUser: "root", dbPass: "senha" };
  return s;
}

function withDbCreated(): WpState {
  const s = withConfigured();
  s.dbCreated = true;
  return s;
}

export const WP_CHALLENGES: WpChallenge[] = [
  {
    id: "core-download-1",
    trilha: "Fundamentos",
    title: "Baixe o WordPress",
    description:
      "Você está numa pasta vazia, pronta para hospedar um site novo. Baixe os arquivos do WordPress.",
    hint: "Existe um subcomando 'core' que lida com os arquivos centrais do WordPress. Qual verbo, em inglês, baixa esses arquivos pela primeira vez?",
    setup: () => createInitialWpState(),
    goal: (s) => s.downloaded,
  },
  {
    id: "config-create-1",
    trilha: "Fundamentos",
    title: "Configure a conexão com o banco",
    description:
      "Os arquivos já foram baixados. Crie o 'wp-config.php' apontando para um banco chamado 'meusite', usuário 'root' e senha 'senha'.",
    hint: "O subcomando 'config' tem uma ação que cria esse arquivo. Ele espera as flags --dbname, --dbuser e --dbpass.",
    setup: () => withDownloaded(),
    goal: (s) =>
      s.config?.dbName === "meusite" && s.config?.dbUser === "root" && s.config?.dbPass === "senha",
  },
  {
    id: "db-create-1",
    trilha: "Fundamentos",
    title: "Crie o banco de dados",
    description: "O 'wp-config.php' já existe. Crie o banco de dados que ele descreve.",
    hint: "Existe um subcomando 'db', separado de 'config', que cria o banco de verdade a partir do que já está configurado.",
    setup: () => withConfigured(),
    goal: (s) => s.dbCreated,
  },
  {
    id: "core-install-1",
    trilha: "Fundamentos",
    title: "Instale o WordPress",
    description:
      "O banco já existe. Instale o WordPress no site 'https://meusite.local', título 'Meu Site', usuário admin 'admin' e email 'admin@meusite.local'.",
    hint: "É o mesmo subcomando de baixar os arquivos ('core'), com outra ação. Ele espera --url, --title, --admin_user, --admin_password e --admin_email.",
    setup: () => withDbCreated(),
    goal: (s) => s.installed && s.site?.url === "https://meusite.local",
  },
];
