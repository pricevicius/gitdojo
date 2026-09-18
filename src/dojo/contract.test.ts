import { describe, expect, it } from "vitest";
import { DOJOS } from "./registry";

/**
 * Rede de segurança para dojos de terceiros: valida invariantes estruturais
 * do contrato `Dojo<TState>` sem saber nada da ferramenta específica. Roda
 * automaticamente em qualquer PR que adicione um dojo a DOJOS (registry.ts).
 */
describe("contrato Dojo", () => {
  it("tem domainSlug e subdomain únicos entre os dojos", () => {
    const domainSlugs = DOJOS.map((d) => d.domainSlug);
    const subdomains = DOJOS.map((d) => d.subdomain);
    expect(new Set(domainSlugs).size).toBe(domainSlugs.length);
    expect(new Set(subdomains).size).toBe(subdomains.length);
  });

  for (const dojo of DOJOS) {
    describe(`dojo "${dojo.domainSlug}"`, () => {
      it("tem pelo menos um desafio", () => {
        expect(dojo.challenges.length).toBeGreaterThan(0);
      });

      it("toda trilha de challenge está em trilhasOrder", () => {
        for (const challenge of dojo.challenges) {
          expect(dojo.trilhasOrder).toContain(challenge.trilha);
        }
      });

      it("toda entrada de trilhasOrder tem pelo menos um desafio", () => {
        for (const trilha of dojo.trilhasOrder) {
          const hasChallenge = dojo.challenges.some((c) => c.trilha === trilha);
          expect(hasChallenge).toBe(true);
        }
      });

      it("tem dicionário não vazio", () => {
        expect(Object.keys(dojo.dictionary).length).toBeGreaterThan(0);
      });

      it("createInitialState não lança exceção", () => {
        expect(() => dojo.createInitialState()).not.toThrow();
      });

      it("runCommand com entrada vazia não lança exceção", () => {
        const state = dojo.createInitialState();
        expect(() => dojo.runCommand("", state)).not.toThrow();
      });
    });
  }
});
