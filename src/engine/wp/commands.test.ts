import { describe, it, expect } from "vitest";
import { runCommand } from "./commands";
import { createInitialWpState } from "./types";
import type { WpState } from "./types";

function download(): WpState {
  return runCommand("wp core download", createInitialWpState()).state;
}

function configure(): WpState {
  return runCommand(
    "wp config create --dbname=meusite --dbuser=root --dbpass=senha",
    download()
  ).state;
}

function createDb(): WpState {
  return runCommand("wp db create", configure()).state;
}

function installed(): WpState {
  return runCommand(
    "wp core install --url=https://meusite.local --title=X --admin_user=admin --admin_password=s --admin_email=a@meusite.local",
    createDb()
  ).state;
}

describe("wp core download", () => {
  it("baixa os arquivos", () => {
    const result = runCommand("wp core download", createInitialWpState());
    expect(result.ok).toBe(true);
    expect(result.state.downloaded).toBe(true);
    expect(result.unlockedCommand).toBe("wp core download");
  });

  it("baixar de novo não quebra nada", () => {
    const result = runCommand("wp core download", download());
    expect(result.ok).toBe(true);
  });
});

describe("wp config create", () => {
  it("falha sem os arquivos baixados", () => {
    const result = runCommand(
      "wp config create --dbname=x --dbuser=y --dbpass=z",
      createInitialWpState()
    );
    expect(result.ok).toBe(false);
  });

  it("falha sem as flags obrigatórias", () => {
    const result = runCommand("wp config create --dbname=x", download());
    expect(result.ok).toBe(false);
  });

  it("cria a configuração com as flags corretas", () => {
    const result = runCommand(
      "wp config create --dbname=meusite --dbuser=root --dbpass=senha",
      download()
    );
    expect(result.ok).toBe(true);
    expect(result.state.config).toEqual({
      dbName: "meusite",
      dbUser: "root",
      dbPass: "senha",
    });
    expect(result.unlockedCommand).toBe("wp config create");
  });
});

describe("wp db create", () => {
  it("falha sem config", () => {
    const result = runCommand("wp db create", download());
    expect(result.ok).toBe(false);
  });

  it("cria o banco depois de configurado", () => {
    const result = runCommand("wp db create", configure());
    expect(result.ok).toBe(true);
    expect(result.state.dbCreated).toBe(true);
  });
});

describe("wp core install", () => {
  it("falha sem banco criado", () => {
    const result = runCommand(
      "wp core install --url=https://x.local --title=X --admin_user=admin --admin_password=s --admin_email=a@x.local",
      configure()
    );
    expect(result.ok).toBe(false);
  });

  it("instala com todas as flags", () => {
    const result = runCommand(
      "wp core install --url=https://meusite.local --title=\"Meu Site\" --admin_user=admin --admin_password=senha --admin_email=admin@meusite.local",
      createDb()
    );
    expect(result.ok).toBe(true);
    expect(result.state.installed).toBe(true);
    expect(result.state.site?.url).toBe("https://meusite.local");
    expect(result.state.site?.title).toBe("Meu Site");
  });

  it("falha faltando alguma flag obrigatória", () => {
    const result = runCommand(
      "wp core install --url=https://meusite.local --title=Meu",
      createDb()
    );
    expect(result.ok).toBe(false);
  });
});

describe("wp plugin", () => {
  it("falha sem o site instalado", () => {
    expect(runCommand("wp plugin install akismet --activate", createDb()).ok).toBe(false);
  });

  it("install --activate instala e ativa", () => {
    const result = runCommand("wp plugin install akismet --activate", installed());
    expect(result.ok).toBe(true);
    expect(result.state.plugins.akismet).toEqual({ active: true, version: "1.0.0", updateAvailable: false });
    expect(result.unlockedCommand).toBe("wp plugin install --activate");
  });

  it("install sem --activate não ativa", () => {
    const result = runCommand("wp plugin install akismet", installed());
    expect(result.state.plugins.akismet.active).toBe(false);
  });

  it("update --all zera updateAvailable de todos os plugins desatualizados", () => {
    let s = installed();
    s = {
      ...s,
      plugins: {
        akismet: { active: true, version: "1.0", updateAvailable: true },
        outro: { active: false, version: "2.0", updateAvailable: false },
      },
    };
    const result = runCommand("wp plugin update --all", s);
    expect(result.ok).toBe(true);
    expect(result.state.plugins.akismet.updateAvailable).toBe(false);
    expect(result.unlockedCommand).toBe("wp plugin update --all");
  });

  it("update de um slug que não existe falha", () => {
    expect(runCommand("wp plugin update inexistente", installed()).ok).toBe(false);
  });
});

describe("wp theme", () => {
  it("install --activate desativa temas anteriores", () => {
    let s = installed();
    s = { ...s, themes: { antigo: { active: true, version: "1.0", updateAvailable: false } } };
    const result = runCommand("wp theme install twentytwentyfour --activate", s);
    expect(result.ok).toBe(true);
    expect(result.state.themes.twentytwentyfour.active).toBe(true);
    expect(result.state.themes.antigo.active).toBe(false);
  });
});

describe("wp core update", () => {
  it("falha sem o site instalado", () => {
    expect(runCommand("wp core update", createDb()).ok).toBe(false);
  });

  it("zera coreUpdateAvailable", () => {
    const s = { ...installed(), coreUpdateAvailable: true };
    const result = runCommand("wp core update", s);
    expect(result.ok).toBe(true);
    expect(result.state.coreUpdateAvailable).toBe(false);
  });
});

describe("wp language core update", () => {
  it("zera coreLanguageUpdateAvailable", () => {
    const s = { ...installed(), coreLanguageUpdateAvailable: true };
    const result = runCommand("wp language core update", s);
    expect(result.ok).toBe(true);
    expect(result.state.coreLanguageUpdateAvailable).toBe(false);
    expect(result.unlockedCommand).toBe("wp language core update");
  });

  it("outros subcomandos de language falham", () => {
    expect(runCommand("wp language plugin update", installed()).ok).toBe(false);
  });
});

describe("wp user create", () => {
  it("falha sem login ou email", () => {
    expect(runCommand("wp user create maria", installed()).ok).toBe(false);
  });

  it("cria com role explícito", () => {
    const result = runCommand("wp user create maria maria@x.local --role=editor", installed());
    expect(result.ok).toBe(true);
    expect(result.state.users.maria).toEqual({ email: "maria@x.local", role: "editor" });
  });

  it("sem --role usa subscriber como padrão", () => {
    const result = runCommand("wp user create joao joao@x.local", installed());
    expect(result.state.users.joao.role).toBe("subscriber");
  });

  it("falha se o login já existe", () => {
    const s = runCommand("wp user create maria maria@x.local", installed()).state;
    expect(runCommand("wp user create maria outro@x.local", s).ok).toBe(false);
  });
});

describe("wp db export/import", () => {
  it("export falha sem o banco criado", () => {
    expect(runCommand("wp db export backup.sql", configure()).ok).toBe(false);
  });

  it("export sem nome de arquivo falha", () => {
    expect(runCommand("wp db export", createDb()).ok).toBe(false);
  });

  it("export grava o nome do arquivo", () => {
    const result = runCommand("wp db export backup.sql", createDb());
    expect(result.ok).toBe(true);
    expect(result.state.dbBackupFile).toBe("backup.sql");
    expect(result.unlockedCommand).toBe("wp db export");
  });

  it("import falha se o arquivo não bate com o que foi exportado", () => {
    expect(runCommand("wp db import outro.sql", createDb()).ok).toBe(false);
  });

  it("import restaura a partir de um backup existente", () => {
    const exported = runCommand("wp db export backup.sql", createDb()).state;
    const result = runCommand("wp db import backup.sql", exported);
    expect(result.ok).toBe(true);
    expect(result.state.dbRestoredFrom).toBe("backup.sql");
    expect(result.unlockedCommand).toBe("wp db import");
  });
});

describe("wp search-replace", () => {
  it("falha sem o site instalado", () => {
    expect(
      runCommand("wp search-replace https://meusite.local https://meusite.com.br", createDb()).ok
    ).toBe(false);
  });

  it("falha se o texto de busca não bate com a url atual", () => {
    expect(
      runCommand("wp search-replace https://outro.local https://meusite.com.br", installed()).ok
    ).toBe(false);
  });

  it("troca a url do site", () => {
    const s = { ...installed() };
    s.site = { ...s.site!, url: "https://meusite.local" };
    const result = runCommand(
      "wp search-replace https://meusite.local https://meusite.com.br",
      s
    );
    expect(result.ok).toBe(true);
    expect(result.state.site?.url).toBe("https://meusite.com.br");
    expect(result.unlockedCommand).toBe("wp search-replace");
  });
});

describe("wp cache flush", () => {
  it("falha sem o site instalado", () => {
    expect(runCommand("wp cache flush", createDb()).ok).toBe(false);
  });

  it("limpa o cache sujo", () => {
    const s = { ...installed(), cacheDirty: true };
    const result = runCommand("wp cache flush", s);
    expect(result.ok).toBe(true);
    expect(result.state.cacheDirty).toBe(false);
    expect(result.unlockedCommand).toBe("wp cache flush");
  });

  it("limpar de novo não quebra nada", () => {
    const result = runCommand("wp cache flush", installed());
    expect(result.ok).toBe(true);
  });
});

describe("wp rewrite flush", () => {
  it("falha sem o site instalado", () => {
    expect(runCommand("wp rewrite flush", createDb()).ok).toBe(false);
  });

  it("regenera as regras de permalink", () => {
    const s = { ...installed(), permalinksDirty: true };
    const result = runCommand("wp rewrite flush", s);
    expect(result.ok).toBe(true);
    expect(result.state.permalinksDirty).toBe(false);
    expect(result.unlockedCommand).toBe("wp rewrite flush");
  });
});
