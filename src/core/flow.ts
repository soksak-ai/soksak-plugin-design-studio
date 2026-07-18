// MiniFlow — mermaid flowchart 서브셋의 순수 파서·레이아웃. entry 1MB 법으로 mermaid 를 번들할
// 수 없어(실측 flow-only 1.7MB) 이 렌더러가 Diagram 섹션을 맡는다. 플랫폼 resource 브리지가
// 열리면 mermaid 로 교체한다(제거 조건). 지원: flowchart|graph LR/RL/TD/TB/BT, 노드 [rect]
// (round) {diamond} ((circle)), 엣지 --> --- -.-> ==> 와 |라벨|, 체인·세미콜론 구분.

export type FlowDir = "LR" | "RL" | "TD" | "BT";
export type FlowShape = "rect" | "round" | "diamond" | "circle";

export interface FlowNode {
  id: string;
  label: string;
  shape: FlowShape;
}
export interface FlowEdge {
  from: string;
  to: string;
  label: string;
  dotted: boolean;
}
export type FlowGraph =
  | { ok: true; dir: FlowDir; nodes: FlowNode[]; edges: FlowEdge[] }
  | { ok: false; reason: string };

const NODE_RE = /^([A-Za-z0-9_]+)(\(\((.*?)\)\)|\[(.*?)\]|\((.*?)\)|\{(.*?)\})?$/;
const EDGE_RE = /(-\.->|==>|-->|---)(\|([^|]*)\|)?/g;

function parseNodeRef(
  raw: string,
  nodes: Map<string, FlowNode>,
): string | null {
  const m = NODE_RE.exec(raw.trim());
  if (!m) return null;
  const id = m[1];
  let shape: FlowShape | null = null;
  let label: string | null = null;
  if (m[3] !== undefined) {
    shape = "circle";
    label = m[3];
  } else if (m[4] !== undefined) {
    shape = "rect";
    label = m[4];
  } else if (m[5] !== undefined) {
    shape = "round";
    label = m[5];
  } else if (m[6] !== undefined) {
    shape = "diamond";
    label = m[6];
  }
  const prev = nodes.get(id);
  if (prev) {
    if (shape) {
      prev.shape = shape;
      prev.label = label ?? prev.label;
    }
  } else {
    nodes.set(id, { id, label: label ?? id, shape: shape ?? "rect" });
  }
  return id;
}

export function parseFlow(code: string): FlowGraph {
  const lines = String(code ?? "")
    .split(/[\n;]/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("%%"));
  if (lines.length === 0) return { ok: false, reason: "빈 코드" };
  const head = /^(flowchart|graph)\s+(LR|RL|TD|TB|BT)?/i.exec(lines[0]);
  if (!head) return { ok: false, reason: "flowchart|graph 로 시작해야 합니다(MiniFlow 는 flowchart 서브셋만 지원)" };
  const dirRaw = (head[2] ?? "TD").toUpperCase();
  const dir: FlowDir = dirRaw === "TB" ? "TD" : (dirRaw as FlowDir);
  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];
  for (const line of lines.slice(1)) {
    // 체인: A --> B -->|l| C … 를 (세그먼트, 엣지)들로 분해
    EDGE_RE.lastIndex = 0;
    const ops: { op: string; label: string; index: number; len: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = EDGE_RE.exec(line))) {
      ops.push({ op: m[1], label: m[3] ?? "", index: m.index, len: m[0].length });
    }
    if (ops.length === 0) {
      parseNodeRef(line, nodes); // 독립 노드 선언
      continue;
    }
    const segs: string[] = [];
    let pos = 0;
    for (const op of ops) {
      segs.push(line.slice(pos, op.index));
      pos = op.index + op.len;
    }
    segs.push(line.slice(pos));
    for (let i = 0; i < ops.length; i++) {
      const from = parseNodeRef(segs[i], nodes);
      const to = parseNodeRef(segs[i + 1], nodes);
      if (!from || !to) continue;
      edges.push({ from, to, label: ops[i].label, dotted: ops[i].op === "-.->" });
    }
  }
  if (nodes.size === 0) return { ok: false, reason: "노드가 없습니다" };
  return { ok: true, dir, nodes: [...nodes.values()], edges };
}

// ── 레이아웃 ──

export interface LaidNode extends FlowNode {
  rank: number;
  x: number; // 좌상단
  y: number;
  w: number;
  h: number;
}
export interface LaidEdge extends FlowEdge {
  back: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface FlowLayout {
  dir: FlowDir;
  nodes: LaidNode[];
  edges: LaidEdge[];
  width: number;
  height: number;
}

const GAP_MAIN = 64; // rank 간 간격(엣지 라벨 자리)
const GAP_CROSS = 18;

function textWidth(label: string): number {
  let w = 0;
  for (const ch of label) w += ch.charCodeAt(0) > 0x2e80 ? 13 : 7.2; // CJK 폭 보정
  return w;
}

export function layoutFlow(graph: Extract<FlowGraph, { ok: true }>): FlowLayout {
  const ids = graph.nodes.map((n) => n.id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  // DFS 로 back edge 판별(순방향 DAG 를 남긴다)
  const adj = new Map<string, FlowEdge[]>(ids.map((id) => [id, []]));
  for (const e of graph.edges) adj.get(e.from)?.push(e);
  const state = new Map<string, 0 | 1 | 2>();
  const backSet = new Set<FlowEdge>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const e of adj.get(id) ?? []) {
      const s = state.get(e.to) ?? 0;
      if (s === 1) backSet.add(e);
      else if (s === 0) visit(e.to);
    }
    state.set(id, 2);
  };
  for (const id of ids) if ((state.get(id) ?? 0) === 0) visit(id);
  // 최장경로 rank(순방향 엣지만) — 위상 완화 반복(노드 수 상한)
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass++) {
    let changed = false;
    for (const e of graph.edges) {
      if (backSet.has(e)) continue;
      const want = (rank.get(e.from) ?? 0) + 1;
      if (want > (rank.get(e.to) ?? 0)) {
        rank.set(e.to, want);
        changed = true;
      }
    }
    if (!changed) break;
  }
  // rank 별 그룹(선언 순서 유지)
  const maxRank = Math.max(...rank.values());
  const groups: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const id of ids) groups[rank.get(id) ?? 0].push(id);

  const horizontal = graph.dir === "LR" || graph.dir === "RL";
  const sized = new Map<string, { w: number; h: number }>();
  for (const n of graph.nodes) {
    const tw = textWidth(n.label);
    let w = Math.min(240, Math.max(64, tw + 28));
    let h = 34;
    if (n.shape === "diamond") {
      w = Math.min(260, Math.max(76, tw + 48));
      h = 46;
    }
    if (n.shape === "circle") {
      const d = Math.min(150, Math.max(48, tw + 26));
      w = d;
      h = d;
    }
    sized.set(n.id, { w, h });
  }

  // rank 축 오프셋(누적) + 교차축 배치(그룹 중앙 정렬)
  const rankSpan: number[] = groups.map((g) =>
    Math.max(...g.map((id) => (horizontal ? sized.get(id)!.w : sized.get(id)!.h)), 0),
  );
  const rankOffset: number[] = [];
  let acc = 0;
  for (let r = 0; r <= maxRank; r++) {
    rankOffset[r] = acc;
    acc += rankSpan[r] + GAP_MAIN;
  }
  const crossSpan = (g: string[]) =>
    g.reduce((s, id) => s + (horizontal ? sized.get(id)!.h : sized.get(id)!.w), 0) + GAP_CROSS * Math.max(0, g.length - 1);
  const maxCross = Math.max(...groups.map(crossSpan), 0);

  const placed = new Map<string, LaidNode>();
  for (let r = 0; r <= maxRank; r++) {
    let cross = (maxCross - crossSpan(groups[r])) / 2;
    for (const id of groups[r]) {
      const n = graph.nodes[idx.get(id)!];
      const { w, h } = sized.get(id)!;
      const main = rankOffset[r] + (rankSpan[r] - (horizontal ? w : h)) / 2;
      placed.set(id, {
        ...n,
        rank: r,
        x: horizontal ? main : cross,
        y: horizontal ? cross : main,
        w,
        h,
      });
      cross += (horizontal ? h : w) + GAP_CROSS;
    }
  }
  const width = horizontal ? acc - GAP_MAIN : maxCross;
  const height = horizontal ? maxCross : acc - GAP_MAIN;

  const edges: LaidEdge[] = graph.edges.map((e) => {
    const a = placed.get(e.from)!;
    const b = placed.get(e.to)!;
    const back = backSet.has(e);
    let x1: number, y1: number, x2: number, y2: number;
    if (horizontal) {
      x1 = a.x + a.w;
      y1 = a.y + a.h / 2;
      x2 = b.x;
      y2 = b.y + b.h / 2;
      if (back) {
        x1 = a.x + a.w / 2;
        y1 = a.y + a.h;
        x2 = b.x + b.w / 2;
        y2 = b.y + b.h;
      }
    } else {
      x1 = a.x + a.w / 2;
      y1 = a.y + a.h;
      x2 = b.x + b.w / 2;
      y2 = b.y;
      if (back) {
        x1 = a.x;
        y1 = a.y + a.h / 2;
        x2 = b.x;
        y2 = b.y + b.h / 2;
      }
    }
    return { ...e, back, x1, y1, x2, y2 };
  });

  return { dir: graph.dir, nodes: [...placed.values()], edges, width, height };
}
