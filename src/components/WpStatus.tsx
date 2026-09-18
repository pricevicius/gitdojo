import type { WpState } from "../engine/wp/types";

interface Props {
  state: WpState;
}

const STEPS: { label: string; done: (s: WpState) => boolean }[] = [
  { label: "Arquivos baixados (core download)", done: (s) => s.downloaded },
  { label: "wp-config.php criado (config create)", done: (s) => s.config !== null },
  { label: "Banco de dados criado (db create)", done: (s) => s.dbCreated },
  { label: "WordPress instalado (core install)", done: (s) => s.installed },
];

export default function WpStatus({ state }: Props) {
  return (
    <div className="wp-status">
      <ul className="wp-status-steps">
        {STEPS.map((step) => {
          const done = step.done(state);
          return (
            <li key={step.label} className={done ? "wp-status-step done" : "wp-status-step"}>
              <span className="wp-status-check">{done ? "✓" : "○"}</span>
              {step.label}
            </li>
          );
        })}
      </ul>
      {state.site && (
        <div className="wp-status-site">
          <p>
            <strong>{state.site.title}</strong>
            {state.coreUpdateAvailable && <span className="wp-status-badge">atualização disponível</span>}
          </p>
          <p className="hint">{state.site.url}</p>
          <p className="hint">admin: {state.site.adminUser}</p>

          <WpAssetList title="Plugins" assets={state.plugins} />
          <WpAssetList title="Temas" assets={state.themes} />

          {Object.keys(state.users).length > 0 && (
            <div className="wp-status-list">
              <span className="hint">Usuários</span>
              <ul>
                {Object.entries(state.users).map(([login, u]) => (
                  <li key={login}>
                    {login} <span className="hint">({u.role})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WpAssetList({
  title,
  assets,
}: {
  title: string;
  assets: WpState["plugins"] | WpState["themes"];
}) {
  const entries = Object.entries(assets);
  if (entries.length === 0) return null;
  return (
    <div className="wp-status-list">
      <span className="hint">{title}</span>
      <ul>
        {entries.map(([slug, a]) => (
          <li key={slug}>
            {slug}
            {a.active && <span className="wp-status-badge">ativo</span>}
            {a.updateAvailable && <span className="wp-status-badge outdated">atualização</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
