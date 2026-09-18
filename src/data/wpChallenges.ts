import type { WpState } from "../engine/wp/types";
import { createInitialWpState } from "../engine/wp/types";
import type { DojoChallenge } from "../dojo/types";

export type WpChallenge = DojoChallenge<WpState>;

const WP_TRILHAS_ORDER = [
  "Fundamentos",
  "Plugins e Temas",
  "Atualizações",
  "Usuários",
  "Migração e Manutenção",
] as const;
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

/** Site já instalado, sem plugins/temas/usuários extras — ponto de partida das trilhas do dia a dia. */
function withInstalledSite(): WpState {
  const s = withDbCreated();
  s.installed = true;
  s.site = {
    url: "https://meusite.local",
    title: "Meu Site",
    adminUser: "admin",
    adminEmail: "admin@meusite.local",
  };
  return s;
}

function withOutdatedCore(): WpState {
  const s = withInstalledSite();
  s.coreUpdateAvailable = true;
  return s;
}

function withOutdatedPlugin(): WpState {
  const s = withInstalledSite();
  s.plugins["akismet"] = { active: true, version: "4.0", updateAvailable: true };
  return s;
}

function withOutdatedLanguage(): WpState {
  const s = withInstalledSite();
  s.coreLanguageUpdateAvailable = true;
  return s;
}

function withBackup(): WpState {
  const s = withInstalledSite();
  s.dbBackupFile = "backup.sql";
  return s;
}

function withDirtyCache(): WpState {
  const s = withInstalledSite();
  s.cacheDirty = true;
  return s;
}

function withDirtyPermalinks(): WpState {
  const s = withInstalledSite();
  s.permalinksDirty = true;
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
  {
    id: "plugin-install-1",
    trilha: "Plugins e Temas",
    title: "Instale e ative um plugin",
    description:
      "O site já está no ar. Instale o plugin 'akismet' e já ative-o, num único comando.",
    hint: "Existe um subcomando 'plugin' com uma ação que instala a partir do repositório oficial do WordPress. Uma flag, sem valor, já ativa o plugin na mesma tacada.",
    setup: () => withInstalledSite(),
    goal: (s) => s.plugins["akismet"]?.active === true,
  },
  {
    id: "theme-install-1",
    trilha: "Plugins e Temas",
    title: "Instale e ative um tema",
    description: "Instale o tema 'twentytwentyfour' e já ative-o, num único comando.",
    hint: "É o mesmo padrão do plugin, mas o subcomando é outro — pense na palavra em inglês para 'tema visual'.",
    setup: () => withInstalledSite(),
    goal: (s) => s.themes["twentytwentyfour"]?.active === true,
  },
  {
    id: "core-update-1",
    trilha: "Atualizações",
    title: "Atualize o WordPress",
    description: "Existe uma atualização do WordPress em si disponível. Aplique-a.",
    hint: "É o mesmo subcomando que baixa e instala o WordPress ('core'), com uma terceira ação.",
    setup: () => withOutdatedCore(),
    goal: (s) => s.coreUpdateAvailable === false,
  },
  {
    id: "plugin-update-1",
    trilha: "Atualizações",
    title: "Atualize todos os plugins",
    description: "O plugin 'akismet' tem uma atualização disponível. Atualize todos os plugins de uma vez.",
    hint: "Mesmo subcomando 'plugin' de instalar, ação de atualizar. Existe uma flag que aplica em todos os plugins instalados, sem precisar listar cada slug.",
    setup: () => withOutdatedPlugin(),
    goal: (s) => s.plugins["akismet"]?.updateAvailable === false,
  },
  {
    id: "language-update-1",
    trilha: "Atualizações",
    title: "Atualize as traduções",
    description: "As traduções do WordPress ficaram desatualizadas. Atualize-as.",
    hint: "Existe um subcomando 'language', separado de 'core' e 'plugin', para lidar com traduções. A ação usada aqui é a mesma de atualizar o core, mas aplicada às traduções do 'core'.",
    setup: () => withOutdatedLanguage(),
    goal: (s) => s.coreLanguageUpdateAvailable === false,
  },
  {
    id: "user-create-1",
    trilha: "Usuários",
    title: "Crie um usuário novo",
    description:
      "Você precisa dar acesso de edição de conteúdo (sem mexer em configurações do site) para uma pessoa nova: 'maria', email 'maria@meusite.local', papel 'editor'.",
    hint: "Existe um subcomando 'user' com uma ação que cria contas, esperando login e email como argumentos posicionais, e uma flag --role para o papel.",
    setup: () => withInstalledSite(),
    goal: (s) => s.users["maria"]?.email === "maria@meusite.local" && s.users["maria"]?.role === "editor",
  },
  {
    id: "db-export-1",
    trilha: "Migração e Manutenção",
    title: "Faça um backup do banco",
    description:
      "Antes de mexer em qualquer coisa arriscada, exporte o banco de dados para o arquivo 'backup.sql'.",
    hint: "Existe uma ação do subcomando 'db' que gera um dump .sql do banco. Passe o nome do arquivo como argumento.",
    setup: () => withInstalledSite(),
    goal: (s) => s.dbBackupFile === "backup.sql",
  },
  {
    id: "db-import-1",
    trilha: "Migração e Manutenção",
    title: "Restaure um backup",
    description: "Existe um backup em 'backup.sql'. Restaure o banco de dados a partir dele.",
    hint: "Mesmo subcomando 'db', outra ação — o oposto de exportar.",
    setup: () => withBackup(),
    goal: (s) => s.dbRestoredFrom === "backup.sql",
  },
  {
    id: "search-replace-1",
    trilha: "Migração e Manutenção",
    title: "Migre o site para um domínio novo",
    description:
      "O site está em 'https://meusite.local', mas o domínio definitivo é 'https://meusite.com.br'. Troque todas as ocorrências no banco.",
    hint: "Existe um comando com dois argumentos posicionais — o texto antigo e o novo — que troca no banco inteiro com segurança, inclusive dentro de dados serializados do PHP.",
    setup: () => withInstalledSite(),
    goal: (s) => s.site?.url === "https://meusite.com.br",
  },
  {
    id: "cache-flush-1",
    trilha: "Migração e Manutenção",
    title: "Limpe o cache",
    description: "Depois de uma mudança recente, o cache do site ficou desatualizado. Limpe-o.",
    hint: "Existe um subcomando 'cache' com uma ação que limpa tudo de uma vez.",
    setup: () => withDirtyCache(),
    goal: (s) => s.cacheDirty === false,
  },
  {
    id: "rewrite-flush-1",
    trilha: "Migração e Manutenção",
    title: "Atualize os links permanentes",
    description:
      "Você mudou a estrutura de permalinks nas configurações, mas as regras de rewrite do servidor ainda não foram regeneradas. Corrija isso.",
    hint: "Existe um subcomando 'rewrite' com uma ação que regenera essas regras.",
    setup: () => withDirtyPermalinks(),
    goal: (s) => s.permalinksDirty === false,
  },
];
