// Diagram 섹션 렌더 — MiniFlow(core/flow) 레이아웃을 SVG 로 그린다. flowchart 서브셋 외
// 코드는 오류 박스로 안내한다(디자인의 Mermaid 오류 표면과 동형). 폴링·외부 로드 없음.
import { useMemo } from "react";
import { layoutFlow, parseFlow, type LaidEdge, type LaidNode } from "@/core/flow";
import { FONT_MONO, FONT_SANS } from "@/styles";

const PAD = 8;

function nodeShape(n: LaidNode, c: { fill: string; stroke: string; text: string }) {
  const common = { fill: c.fill, stroke: c.stroke, strokeWidth: 1.2 } as const;
  if (n.shape === "diamond") {
    const pts = [
      [n.x + n.w / 2, n.y],
      [n.x + n.w, n.y + n.h / 2],
      [n.x + n.w / 2, n.y + n.h],
      [n.x, n.y + n.h / 2],
    ]
      .map((p) => p.join(","))
      .join(" ");
    return <polygon points={pts} {...common} />;
  }
  if (n.shape === "circle")
    return <ellipse cx={n.x + n.w / 2} cy={n.y + n.h / 2} rx={n.w / 2} ry={n.h / 2} {...common} />;
  return <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={n.shape === "round" ? n.h / 2 : 5} {...common} />;
}

function edgePath(e: LaidEdge, horizontal: boolean): string {
  if (!e.back) {
    const mx = (e.x1 + e.x2) / 2;
    return horizontal
      ? `M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}`
      : `M ${e.x1} ${e.y1} C ${e.x1} ${(e.y1 + e.y2) / 2}, ${e.x2} ${(e.y1 + e.y2) / 2}, ${e.x2} ${e.y2}`;
  }
  // 역방향: 바깥으로 볼록한 곡선
  const bow = 42;
  return horizontal
    ? `M ${e.x1} ${e.y1} C ${e.x1} ${e.y1 + bow}, ${e.x2} ${e.y2 + bow}, ${e.x2} ${e.y2}`
    : `M ${e.x1} ${e.y1} C ${e.x1 - bow} ${e.y1}, ${e.x2 - bow} ${e.y2}, ${e.x2} ${e.y2}`;
}

export function MiniFlow(props: { code: string; dark: boolean }) {
  const parsed = useMemo(() => parseFlow(props.code), [props.code]);
  if (!parsed.ok) {
    return (
      <div style={{ display: "flex", justifyContent: "center", minHeight: 90, alignItems: "center" }}>
        <div style={{ color: "#c05353", fontFamily: FONT_MONO, fontSize: 11, padding: 12, textAlign: "center", lineHeight: 1.6 }}>
          다이어그램 오류: {parsed.reason}
        </div>
      </div>
    );
  }
  const l = layoutFlow(parsed);
  const horizontal = l.dir === "LR" || l.dir === "RL";
  const c = props.dark
    ? { fill: "#16203a", stroke: "#5f7096", text: "#e6ecf5", line: "#94a3b8", labelBg: "#0d1526" }
    : { fill: "#f4f6f8", stroke: "#8a94a3", text: "#1b2430", line: "#6b7686", labelBg: "#ffffff" };
  const w = l.width + PAD * 2;
  const h = l.height + PAD * 2 + 30; // 역방향 곡선 여유
  return (
    <div style={{ display: "flex", justifyContent: "center", minHeight: 90, overflow: "auto" }}>
      <svg
        viewBox={`${-PAD} ${-PAD} ${w} ${h}`}
        width={w}
        height={h}
        style={{ maxWidth: "100%", fontFamily: FONT_SANS }}
        role="img"
      >
        <defs>
          <marker id="mf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={c.line} />
          </marker>
        </defs>
        {l.edges.map((e, i) => {
          const midX = (e.x1 + e.x2) / 2;
          const midY = e.back ? Math.max(e.y1, e.y2) + (horizontal ? 32 : 0) : (e.y1 + e.y2) / 2;
          const labX = e.back && !horizontal ? Math.min(e.x1, e.x2) - 32 : midX;
          return (
            <g key={i}>
              <path
                d={edgePath(e, horizontal)}
                fill="none"
                stroke={c.line}
                strokeWidth={1.3}
                strokeDasharray={e.dotted ? "4 4" : undefined}
                markerEnd="url(#mf-arrow)"
              />
              {e.label ? (
                <g>
                  <rect
                    x={labX - e.label.length * 5.5 - 4}
                    y={midY - 9}
                    width={e.label.length * 11 + 8}
                    height={18}
                    rx={4}
                    fill={c.labelBg}
                    opacity={0.92}
                  />
                  <text x={labX} y={midY + 4} textAnchor="middle" fontSize={11} fill={c.text}>
                    {e.label}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
        {l.nodes.map((n) => (
          <g key={n.id}>
            {nodeShape(n, c)}
            <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 4} textAnchor="middle" fontSize={12.5} fontWeight={500} fill={c.text}>
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
