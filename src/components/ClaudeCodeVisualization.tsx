import type { ClaudeCodeState } from "../engine/claude-code/types";

interface Props {
  state: ClaudeCodeState;
}

const PERMISSION_LABEL: Record<ClaudeCodeState["permissionMode"], string> = {
  default: "padrão (confirma cada edição)",
  plan: "plano (revisa antes de editar)",
  acceptEdits: "aceita edições automaticamente",
  bypassPermissions: "sem checagem (--dangerously-skip-permissions)",
};

export default function ClaudeCodeVisualization({ state }: Props) {
  if (!state.sessionStarted) {
    return (
      <div className="wp-status">
        <p className="hint">Nenhuma sessão aberta.</p>
        {state.hadPreviousSession && <p className="hint">Há uma sessão anterior retomável.</p>}
      </div>
    );
  }

  return (
    <div className="wp-status">
      <div className="wp-status-site">
        <p>
          <strong>Sessão ativa</strong>
          {state.permissionMode === "bypassPermissions" && (
            <span className="wp-status-badge outdated">sem checagem de permissões</span>
          )}
          {state.pendingEdit && <span className="wp-status-badge">edição pendente</span>}
        </p>
        <p className="hint">contexto: {state.contextPercent}%</p>
        <p className="hint">permissões: {PERMISSION_LABEL[state.permissionMode]}</p>
        <p className="hint">custo: ${state.costUsd.toFixed(2)}</p>
        <p className="hint">CLAUDE.md: {state.memoryFileCreated ? "criado" : "não criado"}</p>

        {state.agents.length > 0 && (
          <div className="wp-status-list">
            <span className="hint">Subagents</span>
            <ul>
              {state.agents.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        )}

        {state.mcpServers.length > 0 && (
          <div className="wp-status-list">
            <span className="hint">Servidores MCP</span>
            <ul>
              {state.mcpServers.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        )}

        {state.hooks.length > 0 && (
          <div className="wp-status-list">
            <span className="hint">Hooks</span>
            <ul>
              {state.hooks.map((event) => (
                <li key={event}>{event}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
