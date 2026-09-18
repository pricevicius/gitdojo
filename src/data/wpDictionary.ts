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
};
