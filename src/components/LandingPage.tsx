import type { AnyDojo } from "../dojo/registry";
import "./LandingPage.css";

const REPO_URL = "https://github.com/pricevicius/gitdojo";

const STEPS = [
  { title: "1. Escolha um dojo", text: "Cada dojo treina uma ferramenta de linha de comando diferente." },
  { title: "2. Resolva desafios no terminal", text: "Digite comandos reais e veja o efeito na hora, num ambiente simulado onde errar não custa nada." },
  { title: "3. Desbloqueie o dicionário", text: "Cada comando bem-sucedido vira um verbete no seu dicionário pessoal — referência rápida pra depois." },
];

interface LandingPageProps {
  dojos: AnyDojo[];
}

export default function LandingPage({ dojos }: LandingPageProps) {
  return (
    <div className="landing">
      <header className="landing-hero">
        <h1>🥋 Dojo</h1>
        <p className="landing-subtitle">
          Treine comandos de linha de comando praticando de verdade — não decorando.
        </p>
        <a className="landing-cta" href={`https://${dojos[0].subdomain}.odojo.com.br`}>
          Começar
        </a>
      </header>

      <section className="landing-section">
        <h2>Por que isso existe</h2>
        <div className="landing-cards">
          <div className="landing-card">
            <h3>O problema</h3>
            <p>
              Ferramenta de linha de comando se aprende de dois jeitos ruins: decorando
              comando por comando sem entender o efeito, ou "aprendendo apanhando" direto em
              produção, quando o erro já custou caro.
            </p>
          </div>
          <div className="landing-card">
            <h3>A ideia</h3>
            <p>
              Em vez de ler documentação, você resolve desafios reais digitando comandos de
              verdade num terminal simulado — e vê o efeito imediatamente. Errar não tem
              custo: é só resetar o desafio.
            </p>
          </div>
          <div className="landing-card">
            <h3>Por que "Dojo"</h3>
            <p>
              A mesma estrutura de terminal, desafio e dicionário serve pra qualquer CLI —
              hoje git e wp-cli, amanhã o que a comunidade quiser trazer. Não é um curso;
              é uma forma de treinar memória muscular de comando.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <h2>Como funciona</h2>
        <div className="landing-steps">
          {STEPS.map((step) => (
            <div className="landing-step" key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>Os dojos</h2>
        <div className="landing-dojo-grid">
          {dojos.map((dojo) => (
            <div key={dojo.domainSlug} className="landing-dojo-card">
              <a className="landing-dojo-card-link" href={`https://${dojo.subdomain}.odojo.com.br`}>
                <h3>{dojo.label}</h3>
                <p>{dojo.challenges.length} desafios</p>
                {dojo.tagline && <p className="landing-dojo-tagline">{dojo.tagline}</p>}
              </a>
              {dojo.contributor && (
                <p className="landing-dojo-contributor">
                  trilha contribuída por{" "}
                  <a href={dojo.contributor.url} target="_blank" rel="noreferrer">
                    {dojo.contributor.name}
                  </a>
                </p>
              )}
            </div>
          ))}
          <div className="landing-dojo-card landing-dojo-card--soon">
            <h3>O próximo é seu</h3>
            <p>Ainda não existe — pode ser o que sua equipe precisar.</p>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <h2>Contribua</h2>
        <p>
          O projeto não tem modelo de negócio fechado hoje — a aposta é que ferramentas de
          onboarding boas nascem de quem está aprendendo, não só de quem já sabe. Adicionar
          um dojo novo é implementar um contrato simples (motor de comandos + desafios +
          dicionário) e plugar na lista de dojos. PRs de trilha nova, desafio novo ou dojo
          novo são bem-vindos.
        </p>
        <a className="landing-link" href={REPO_URL} target="_blank" rel="noreferrer">
          Ver o repositório no GitHub →
        </a>
      </section>

      <footer className="landing-footer">
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          {REPO_URL.replace("https://", "")}
        </a>
      </footer>
    </div>
  );
}
