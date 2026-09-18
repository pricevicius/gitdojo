import type { DictionaryEntry } from "../dojo/types";

export const WP_DICTIONARY: Record<string, DictionaryEntry> = {
  "wp core download": {
    command: "wp core download",
    category: "Fundamentos",
    short: "Baixa os arquivos centrais do WordPress na pasta atual.",
    example: "wp core download",
  },
  "wp config create": {
    command: "wp config create --dbname=<nome> --dbuser=<usuário> --dbpass=<senha>",
    category: "Fundamentos",
    short: "Cria o 'wp-config.php', descrevendo como o WordPress deve se conectar ao banco.",
    example: "wp config create --dbname=meusite --dbuser=root --dbpass=senha",
  },
  "wp db create": {
    command: "wp db create",
    category: "Fundamentos",
    short: "Cria o banco de dados descrito no 'wp-config.php'.",
    example: "wp db create",
  },
  "wp core install": {
    command:
      "wp core install --url=<url> --title=<título> --admin_user=<usuário> --admin_password=<senha> --admin_email=<email>",
    category: "Fundamentos",
    short: "Instala o WordPress de fato: cria as tabelas e o usuário administrador.",
    example:
      "wp core install --url=https://meusite.local --title=\"Meu Site\" --admin_user=admin --admin_password=senha --admin_email=admin@meusite.local",
  },
  "wp plugin install --activate": {
    command: "wp plugin install <slug> --activate",
    category: "Plugins e Temas",
    short: "Instala um plugin do repositório oficial do WordPress e já o ativa, num único comando.",
    example: "wp plugin install akismet --activate",
  },
  "wp theme install --activate": {
    command: "wp theme install <slug> --activate",
    category: "Plugins e Temas",
    short: "Instala um tema do repositório oficial do WordPress e já o ativa (desativando o anterior).",
    example: "wp theme install twentytwentyfour --activate",
  },
  "wp core update": {
    command: "wp core update",
    category: "Atualizações",
    short: "Atualiza os arquivos centrais do WordPress para a versão mais recente.",
    example: "wp core update",
  },
  "wp plugin update --all": {
    command: "wp plugin update --all",
    category: "Atualizações",
    short: "Atualiza todos os plugins instalados que têm uma versão nova disponível.",
    example: "wp plugin update --all",
  },
  "wp language core update": {
    command: "wp language core update",
    category: "Atualizações",
    short: "Atualiza os arquivos de tradução do WordPress para o idioma configurado no site.",
    example: "wp language core update",
  },
  "wp user create": {
    command: "wp user create <login> <email> --role=<papel>",
    category: "Usuários",
    short: "Cria um usuário novo no site, com o papel (permissões) indicado.",
    example: "wp user create maria maria@meusite.local --role=editor",
  },
  "wp db export": {
    command: "wp db export <arquivo>",
    category: "Migração e Manutenção",
    short: "Exporta o banco de dados atual para um arquivo .sql — o backup antes de qualquer mudança arriscada.",
    example: "wp db export backup.sql",
  },
  "wp db import": {
    command: "wp db import <arquivo>",
    category: "Migração e Manutenção",
    short: "Importa um dump .sql, substituindo o conteúdo atual do banco.",
    example: "wp db import backup.sql",
  },
  "wp search-replace": {
    command: "wp search-replace <busca> <troca>",
    category: "Migração e Manutenção",
    short:
      "Busca e substitui um texto em todo o banco, respeitando dados serializados do PHP — o jeito seguro de trocar URLs numa migração entre ambientes.",
    example: "wp search-replace https://meusite.local https://meusite.com.br",
  },
  "wp cache flush": {
    command: "wp cache flush",
    category: "Migração e Manutenção",
    short: "Limpa o cache de objetos do WordPress.",
    example: "wp cache flush",
  },
  "wp rewrite flush": {
    command: "wp rewrite flush",
    category: "Migração e Manutenção",
    short: "Regenera as regras de rewrite (permalinks) do site.",
    example: "wp rewrite flush",
  },
};
