import { describe, expect, it } from "vitest";
import { resolveRoute } from "./routing";
import { DOJOS } from "./dojo/registry";

describe("resolveRoute", () => {
  it("mostra a landing page no domínio raiz", () => {
    expect(resolveRoute("odojo.com.br", DOJOS)).toEqual({ view: "landing" });
    expect(resolveRoute("www.odojo.com.br", DOJOS)).toEqual({ view: "landing" });
  });

  it("abre o dojo de git em git.odojo.com.br", () => {
    expect(resolveRoute("git.odojo.com.br", DOJOS)).toEqual({ view: "dojo", slug: "git" });
  });

  it("abre o dojo de wp-cli em wpcli.odojo.com.br", () => {
    expect(resolveRoute("wpcli.odojo.com.br", DOJOS)).toEqual({ view: "dojo", slug: "wp-cli" });
  });

  it("abre o dojo de Claude Code em claude.odojo.com.br", () => {
    expect(resolveRoute("claude.odojo.com.br", DOJOS)).toEqual({ view: "dojo", slug: "claude-code" });
  });

  it("abre o dojo de Java em java.odojo.com.br", () => {
    expect(resolveRoute("java.odojo.com.br", DOJOS)).toEqual({ view: "dojo", slug: "java" });
  });

  it("cai no primeiro dojo em hostnames desconhecidos (localhost, preview)", () => {
    expect(resolveRoute("localhost", DOJOS)).toEqual({ view: "dojo", slug: DOJOS[0].domainSlug });
    expect(resolveRoute("gitdojo.pages.dev", DOJOS)).toEqual({ view: "dojo", slug: DOJOS[0].domainSlug });
  });
});
