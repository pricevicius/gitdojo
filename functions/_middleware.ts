/**
 * Cloudflare Pages Function: um único build estático serve odojo.com.br,
 * git.odojo.com.br e wpcli.odojo.com.br (ver docs/DEPLOY.md), então o
 * index.html não pode ter title/description/OG fixos — quem compartilha um
 * link de um dojo específico via WhatsApp/Slack/Twitter precisa ver o preview
 * daquele dojo, não um genérico "Git Dojo" sem imagem. Isso reescreve as tags
 * de `<head>` por hostname antes de responder, sem precisar de SSR de verdade.
 */

interface SeoVariant {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

const ROOT_HOSTS = new Set(["odojo.com.br", "www.odojo.com.br"]);

const VARIANTS: Record<string, SeoVariant> = {
  root: {
    title: "Dojo — treine comandos de terminal de verdade",
    description:
      "Treine git, wp-cli e outras ferramentas de linha de comando resolvendo desafios num terminal simulado no navegador — sem instalar nada, sem risco de quebrar produção.",
    image: "/og/root.png",
    imageAlt: "Dojo — treine comandos de terminal de verdade",
  },
  git: {
    title: "Dojo de Git — pratique git de verdade no navegador",
    description:
      "Resolva desafios reais de git — branches, merge, rebase, tags — num terminal simulado. Erre à vontade: não tem repositório de verdade pra quebrar.",
    image: "/og/git.png",
    imageAlt: "Dojo de Git",
  },
  wpcli: {
    title: "Dojo de WP-CLI — pratique wp-cli de verdade no navegador",
    description:
      "Resolva desafios reais de wp-cli — instalação, plugins, temas, migração de banco — num terminal simulado. Erre à vontade: não tem site de verdade pra quebrar.",
    image: "/og/wpcli.png",
    imageAlt: "Dojo de WP-CLI",
  },
};

function variantFor(hostname: string): { variant: SeoVariant; canonical: string } {
  if (ROOT_HOSTS.has(hostname)) {
    return { variant: VARIANTS.root, canonical: "https://odojo.com.br/" };
  }
  const subdomain = hostname.split(".")[0];
  if (subdomain in VARIANTS) {
    return { variant: VARIANTS[subdomain], canonical: `https://${hostname}/` };
  }
  // hostname desconhecido (preview do Cloudflare Pages, localhost por engano): cai no genérico.
  return { variant: VARIANTS.root, canonical: `https://${hostname}/` };
}

class SetTextContent {
  constructor(private readonly content: string) {}
  element(el: Element) {
    el.setInnerContent(this.content);
  }
}

class SetAttribute {
  constructor(
    private readonly attr: string,
    private readonly value: string
  ) {}
  element(el: Element) {
    el.setAttribute(this.attr, this.value);
  }
}

interface RequestContext {
  request: Request;
  next: () => Promise<Response>;
}

export const onRequest = async (context: RequestContext): Promise<Response> => {
  const response = await context.next();

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const url = new URL(context.request.url);
  const { variant, canonical } = variantFor(url.hostname);
  const imageUrl = `${canonical.replace(/\/$/, "")}${variant.image}`;

  return new HTMLRewriter()
    .on("title", new SetTextContent(variant.title))
    .on('meta[name="description"]', new SetAttribute("content", variant.description))
    .on('link[rel="canonical"]', new SetAttribute("href", canonical))
    .on('meta[property="og:url"]', new SetAttribute("content", canonical))
    .on('meta[property="og:title"]', new SetAttribute("content", variant.title))
    .on('meta[property="og:description"]', new SetAttribute("content", variant.description))
    .on('meta[property="og:image"]', new SetAttribute("content", imageUrl))
    .on('meta[property="og:image:alt"]', new SetAttribute("content", variant.imageAlt))
    .on('meta[name="twitter:title"]', new SetAttribute("content", variant.title))
    .on('meta[name="twitter:description"]', new SetAttribute("content", variant.description))
    .on('meta[name="twitter:image"]', new SetAttribute("content", imageUrl))
    .transform(response);
};
