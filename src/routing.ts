import type { AnyDojo } from "./dojo/registry";

export type Route = { view: "landing" } | { view: "dojo"; slug: string };

const ROOT_HOSTS = new Set(["odojo.com.br", "www.odojo.com.br"]);

/**
 * odojo.com.br mostra a landing page; git.odojo.com.br / wpcli.odojo.com.br abrem o
 * dojo direto. Qualquer outro hostname (localhost, preview do Cloudflare Pages, IP) cai
 * no fallback do primeiro dojo — mantém `npm run dev` abrindo direto no app, sem LP.
 */
export function resolveRoute(hostname: string, dojos: AnyDojo[]): Route {
  if (ROOT_HOSTS.has(hostname)) return { view: "landing" };

  const subdomain = hostname.split(".")[0];
  const match = dojos.find((d) => d.subdomain === subdomain);
  return { view: "dojo", slug: (match ?? dojos[0]).domainSlug };
}
