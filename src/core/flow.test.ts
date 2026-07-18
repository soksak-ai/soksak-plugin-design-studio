// MiniFlow 파서·레이아웃 계약 — 디자인 기본 다이어그램(flowchart LR, 분기+역방향 엣지)을
// 정확히 소화해야 한다. mermaid 는 entry 1MB 법으로 번들 불가 — 이 서브셋 렌더러가 대행한다.
import { describe, it, expect } from "vitest";
import { parseFlow, layoutFlow } from "@/core/flow";

const DEFAULT_CODE =
  "flowchart LR\n  A[아이디어] --> B(디자인)\n  B --> C{리뷰}\n  C -->|승인| D[퍼블리시]\n  C -->|수정| B";

describe("parseFlow", () => {
  it("기본 다이어그램: 노드 4종·엣지 4개·방향 LR", () => {
    const g = parseFlow(DEFAULT_CODE);
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.dir).toBe("LR");
    expect(g.nodes.map((n) => n.id)).toEqual(["A", "B", "C", "D"]);
    expect(g.nodes.find((n) => n.id === "A")!.shape).toBe("rect");
    expect(g.nodes.find((n) => n.id === "B")!.shape).toBe("round");
    expect(g.nodes.find((n) => n.id === "C")!.shape).toBe("diamond");
    expect(g.nodes.find((n) => n.id === "C")!.label).toBe("리뷰");
    expect(g.edges).toHaveLength(4);
    expect(g.edges[2]).toMatchObject({ from: "C", to: "D", label: "승인" });
    expect(g.edges[3]).toMatchObject({ from: "C", to: "B", label: "수정" });
  });

  it("TD 방향·서클·점선·체인 문법", () => {
    const g = parseFlow("flowchart TD\nS((시작)) -.-> M[중간] --> E((끝))");
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.dir).toBe("TD");
    expect(g.nodes.find((n) => n.id === "S")!.shape).toBe("circle");
    expect(g.edges[0]).toMatchObject({ from: "S", to: "M", dotted: true });
    expect(g.edges[1]).toMatchObject({ from: "M", to: "E", dotted: false });
  });

  it("graph 접두·미정의 라벨은 id 폴백, flowchart 아닌 종류는 불가 신고", () => {
    const g = parseFlow("graph LR\nX --> Y");
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.nodes.find((n) => n.id === "X")!.label).toBe("X");
    const seq = parseFlow("sequenceDiagram\nAlice->>Bob: hi");
    expect(seq.ok).toBe(false);
    if (seq.ok) return;
    expect(seq.reason).toContain("flowchart");
    expect(parseFlow("").ok).toBe(false);
  });
});

describe("layoutFlow", () => {
  it("rank: 순방향 최장경로, 역방향 엣지는 back 표시", () => {
    const g = parseFlow(DEFAULT_CODE);
    if (!g.ok) throw new Error("parse failed");
    const l = layoutFlow(g);
    const rank = Object.fromEntries(l.nodes.map((n) => [n.id, n.rank]));
    expect(rank.A).toBe(0);
    expect(rank.B).toBe(1);
    expect(rank.C).toBe(2);
    expect(rank.D).toBe(3);
    const back = l.edges.find((e) => e.from === "C" && e.to === "B");
    expect(back!.back).toBe(true);
    // LR: rank 가 커질수록 x 증가, 같은 rank 는 x 동일
    const nx = Object.fromEntries(l.nodes.map((n) => [n.id, n.x]));
    expect(nx.B).toBeGreaterThan(nx.A);
    expect(nx.C).toBeGreaterThan(nx.B);
    expect(nx.D).toBeGreaterThan(nx.C);
    expect(l.width).toBeGreaterThan(0);
    expect(l.height).toBeGreaterThan(0);
  });

  it("TD: rank 는 y 축으로 진행", () => {
    const g = parseFlow("flowchart TD\nA --> B\nA --> C\nB --> D\nC --> D");
    if (!g.ok) throw new Error("parse failed");
    const l = layoutFlow(g);
    const ny = Object.fromEntries(l.nodes.map((n) => [n.id, n.y]));
    expect(ny.B).toBeGreaterThan(ny.A);
    expect(ny.D).toBeGreaterThan(ny.B);
    // 같은 rank(B,C)는 y 동일, x 는 다름
    expect(ny.B).toBe(ny.C);
  });
});
