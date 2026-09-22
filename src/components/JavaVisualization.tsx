import type { JavaState, JavaTypeDecl, JavaValue } from "../engine/java/types";

interface Props {
  state: JavaState;
}

/**
 * O equivalente ao grafo de commits do dojo de git: mostra o que a sessão tem
 * na memória. Em OOP as duas coisas que precisam ficar visíveis são a
 * hierarquia de tipos (quem herda de quem, quem assina qual contrato) e os
 * objetos vivos com o valor de cada campo — porque é ali que a diferença entre
 * "o molde" e "a instância" deixa de ser abstrata.
 */

/** Formatação só para exibição: não chama toString() do objeto, para a tela
 * nunca ter efeito colateral sobre o estado. */
function formatValue(state: JavaState, value: JavaValue | undefined): string {
  if (!value) return "null";
  switch (value.kind) {
    case "string":
      return `"${value.value}"`;
    case "int":
      return String(value.value);
    case "boolean":
      return String(value.value);
    case "null":
      return "null";
    case "ref": {
      const obj = state.heap[value.objectId];
      return obj ? `→ ${obj.className}` : "null";
    }
  }
}

function TypeCard({ decl }: { decl: JavaTypeDecl }) {
  const isInterface = decl.kind === "interface";
  return (
    <li className={`java-type${isInterface ? " interface" : ""}`}>
      <div className="java-type-header">
        <span className="java-type-kind">{isInterface ? "interface" : "class"}</span>
        <span className="java-type-name">{decl.name}</span>
        {decl.superName && (
          <span className="java-type-rel">
            extends <strong>{decl.superName}</strong>
          </span>
        )}
        {decl.interfaces.length > 0 && (
          <span className="java-type-rel">
            implements <strong>{decl.interfaces.join(", ")}</strong>
          </span>
        )}
      </div>

      {decl.fields.length > 0 && (
        <ul className="java-members">
          {decl.fields.map((f) => (
            <li key={f.name} className="java-member">
              {f.visibility === "private" && <span className="java-lock" title="private">🔒</span>}
              <span className="java-member-type">{f.type}</span> {f.name}
            </li>
          ))}
        </ul>
      )}

      {(decl.constructor || decl.methods.length > 0) && (
        <ul className="java-members">
          {decl.constructor && (
            <li className="java-member java-ctor">
              {decl.name}({decl.constructor.params.map((p) => p.type).join(", ")})
              <span className="hint"> construtor</span>
            </li>
          )}
          {decl.methods.map((m) => (
            <li key={m.name} className="java-member">
              {m.hasOverrideAnnotation && <span className="java-override">@Override</span>}
              <span className="java-member-type">{m.returnType}</span> {m.name}(
              {m.params.map((p) => p.type).join(", ")})
              {m.abstract && <span className="hint"> sem corpo</span>}
            </li>
          ))}
        </ul>
      )}

      {!isInterface && decl.fields.length === 0 && decl.methods.length === 0 && !decl.constructor && (
        <p className="hint java-type-empty">classe vazia — ainda sem campos nem métodos</p>
      )}
    </li>
  );
}

export default function JavaVisualization({ state }: Props) {
  if (!state.jshellStarted) {
    return (
      <div className="java-viz java-viz-empty">
        <p className="hint">O jshell ainda não foi aberto.</p>
        <p className="hint">Assim que abrir, as classes e os objetos da sessão aparecem aqui.</p>
      </div>
    );
  }

  const types = state.typeOrder.map((name) => state.types[name]).filter(Boolean);
  const vars = state.varOrder.map((name) => state.vars[name]).filter(Boolean);

  return (
    <div className="java-viz">
      <section className="java-section">
        <h3 className="java-section-title">Tipos declarados</h3>
        {types.length === 0 ? (
          <p className="hint">Nenhuma classe ainda. Declare uma com: class Ranger {"{ }"}</p>
        ) : (
          <ul className="java-type-list">
            {types.map((decl) => (
              <TypeCard key={decl.name} decl={decl} />
            ))}
          </ul>
        )}
      </section>

      <section className="java-section">
        <h3 className="java-section-title">Objetos vivos</h3>
        {vars.length === 0 ? (
          <p className="hint">Nenhum objeto ainda. Crie um com: new Ranger()</p>
        ) : (
          <ul className="java-object-list">
            {vars.map((v) => {
              const obj = v.value.kind === "ref" ? state.heap[v.value.objectId] : null;
              const polimorfico = obj !== null && obj.className !== v.declaredType;
              return (
                <li key={v.name} className="java-object">
                  <div className="java-object-header">
                    <span className="java-object-name">{v.name}</span>
                    <span className="java-object-type">{v.declaredType}</span>
                    {polimorfico && (
                      <span
                        className="java-object-actual"
                        title="a variável tem um tipo, o objeto dentro dela é de outro — isto é polimorfismo"
                      >
                        guarda um {obj.className}
                      </span>
                    )}
                  </div>
                  {obj ? (
                    Object.keys(obj.fields).length > 0 ? (
                      <ul className="java-fields">
                        {Object.entries(obj.fields).map(([name, value]) => (
                          <li key={name} className="java-field">
                            <span className="java-field-name">{name}</span>
                            <span className="java-field-value">{formatValue(state, value)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="hint">objeto sem campos</p>
                    )
                  ) : (
                    <p className="hint">{formatValue(state, v.value)}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {state.printed.length > 0 && (
        <section className="java-section">
          <h3 className="java-section-title">Saída da sessão</h3>
          <pre className="java-printed">{state.printed.join("\n")}</pre>
        </section>
      )}
    </div>
  );
}
