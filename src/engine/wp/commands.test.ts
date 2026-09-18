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
