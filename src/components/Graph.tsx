import { useMemo } from "react";
import type { RepoState } from "../engine/types";

interface Props {
  state: RepoState;
}

const COL_W = 90;
const ROW_H = 70;
const MARGIN_X = 60;
const MARGIN_Y = 40;

export default function Graph({ state }: Props) {
  const layout = useMemo(() => computeLayout(state), [state]);

  const currentCommitId =
    state.head.type === "branch" ? state.branches[state.head.name] : state.head.commit;

  if (!state.initialized) {
    return (
      <div className="graph-empty">
        <p>Nenhum repositório ainda.</p>
        <p className="hint">rode <code>git init</code> para começar</p>
      </div>
    );
  }

  const width = Math.max(360, layout.maxDepth * COL_W + MARGIN_X * 2 + 40);
  const height = Math.max(
    200,
    layout.maxLane * ROW_H + MARGIN_Y * 2 + 60 + Math.max(0, layout.maxTagsOnCommit - 1) * 24
  );

  return (
    <svg className="graph-svg" viewBox={`0 0 ${width} ${height}`} width="100%">
      {layout.edges.map(([fromId, toId], i) => {
        const a = layout.positions[fromId];
        const b = layout.positions[toId];
        if (!a || !b) return null;
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--edge-color)"
            strokeWidth={2}
          />
        );
      })}

      {Object.entries(layout.positions).map(([id, pos]) => {
        const commit = state.commits[id];
        const isCurrent = id === currentCommitId;
        return (
          <g key={id}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={16}
              className={isCurrent ? "commit-node current" : "commit-node"}
            />
            <text x={pos.x} y={pos.y + 4} textAnchor="middle" className="commit-id">
              {id}
            </text>
            <text x={pos.x} y={pos.y + 34} textAnchor="middle" className="commit-msg">
              {truncate(commit.message, 16)}
            </text>
          </g>
        );
      })}

      {layout.branchLabels.map((b, i) => (
        <g key={`branch-${i}`} transform={`translate(${b.x}, ${b.y})`}>
          <rect
            x={-4}
            y={-30}
            width={b.width}
            height={20}
            rx={10}
            className={b.isHead ? "branch-pill head" : "branch-pill"}
          />
          <text x={b.width / 2 - 4} y={-16} textAnchor="middle" className="branch-label">
            {b.isHead ? "→ " : ""}
            {b.name}
          </text>
        </g>
      ))}

      {layout.tagLabels.map((t, i) => (
        <g key={`tag-${i}`} transform={`translate(${t.x}, ${t.y})`}>
          <rect x={-4} y={-30} width={t.width} height={20} rx={4} className="tag-pill" />
          <text x={t.width / 2 - 4} y={-16} textAnchor="middle" className="tag-label">
            🏷 {t.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function computeLayout(state: RepoState) {
  const lanes: Record<string, number> = {};
  Object.keys(state.branches).forEach((name, i) => {
    lanes[name] = i;
  });

  const depthCache: Record<string, number> = {};
  function depth(id: string): number {
    if (depthCache[id] !== undefined) return depthCache[id];
    const c = state.commits[id];
    const d = c.parentIds.length === 0 ? 0 : 1 + Math.max(...c.parentIds.map(depth));
    depthCache[id] = d;
    return d;
  }

  const positions: Record<string, { x: number; y: number }> = {};
  const commitIds = Object.keys(state.commits);
  let maxDepth = 0;
  let maxLane = Math.max(0, Object.keys(lanes).length - 1);

  commitIds.forEach((id) => {
    const c = state.commits[id];
    const lane = lanes[c.createdOnBranch] ?? 0;
    const d = depth(id);
    maxDepth = Math.max(maxDepth, d);
    positions[id] = {
      x: MARGIN_X + d * COL_W,
      y: MARGIN_Y + lane * ROW_H,
    };
  });

  const edges: [string, string][] = [];
  commitIds.forEach((id) => {
    state.commits[id].parentIds.forEach((p) => edges.push([id, p]));
  });

  const branchLabels: { name: string; x: number; y: number; width: number; isHead: boolean }[] =
    [];
  Object.entries(state.branches).forEach(([name, tip]) => {
    if (!tip || !positions[tip]) return;
    const pos = positions[tip];
    const isHead = state.head.type === "branch" && state.head.name === name;
    branchLabels.push({
      name,
      x: pos.x - 30,
      y: pos.y,
      width: Math.max(50, name.length * 8 + 20),
      isHead,
    });
  });

  const tagLabels: { name: string; x: number; y: number; width: number }[] = [];
  const tagsPerCommit: Record<string, number> = {};
  let maxTagsOnCommit = 0;
  Object.entries(state.tags).forEach(([name, tag]) => {
    const pos = positions[tag.commit];
    if (!pos) return;
    const i = tagsPerCommit[tag.commit] ?? 0;
    tagsPerCommit[tag.commit] = i + 1;
    maxTagsOnCommit = Math.max(maxTagsOnCommit, i + 1);
    tagLabels.push({
      name,
      x: pos.x - 30,
      y: pos.y + 54 + i * 24,
      width: Math.max(50, name.length * 8 + 30),
    });
  });

  return { positions, edges, branchLabels, tagLabels, maxDepth, maxLane, maxTagsOnCommit };
}
