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
          </p>
          <p className="hint">{state.site.url}</p>
          <p className="hint">admin: {state.site.adminUser}</p>
        </div>
      )}
    </div>
  );
}
