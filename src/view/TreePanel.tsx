// 구조 트리 — Page → 섹션 → 레이아웃 래퍼(VStack/HStack/Grid) → 필드·항목 계층.
// 트리 패널 — 접기 상태·선택 하이라이트·필드/항목/컬럼 링크 선택.
import type { Section } from "@/types";
import type { StudioState } from "@/store";
import { CATALOG } from "@/core/model";
import { FONT_MONO } from "@/styles";
import type { ViewApi } from "@/view/common";

interface TreeNode {
  label: string;
  sub?: string;
  key?: string;
  kids?: TreeNode[];
  wrap?: boolean;
  isSel?: boolean;
  sel?: () => void;
  w?: number;
  color?: string;
  fs?: string;
}

interface Row {
  label: string;
  sub: string;
  caret: string;
  onToggle: (() => void) | null;
  onSelect: () => void;
  depth: number;
  bg: string;
  weight: number;
  color: string;
  fs: string;
}

export function TreePanel(props: {
  S: StudioState;
  V: ViewApi;
  collapsed: Record<string, boolean>;
  setCollapsed(next: Record<string, boolean>): void;
}) {
  const { S, V, collapsed } = props;
  const rows: Row[] = [];
  const toggle = (key: string) => () => props.setCollapsed({ ...collapsed, [key]: !collapsed[key] });

  const emit = (node: TreeNode, depth: number): void => {
    const hasKids = !!node.kids && node.kids.length > 0;
    const isCollapsed = node.key ? !!collapsed[node.key] : false;
    rows.push({
      label: node.label,
      sub: node.sub ?? "",
      caret: hasKids ? (isCollapsed ? "▶" : "▼") : "",
      onToggle: hasKids && node.key ? toggle(node.key) : null,
      onSelect: node.sel ?? (() => undefined),
      depth,
      bg: node.isSel ? "#eef2ff" : "transparent",
      weight: node.w ?? (node.isSel ? 600 : 400),
      color: node.color ?? (node.wrap ? "#8a94a3" : "#4a5568"),
      fs: node.fs ?? "11px",
    });
    if (hasKids && !isCollapsed) node.kids!.forEach((k) => emit(k, depth + 1));
  };

  const pageName = S.pages.find((p) => p.id === S.curPage)?.name ?? "untitled-page";
  rows.push({
    label: "Page",
    sub: pageName,
    caret: collapsed["page"] ? "▶" : "▼",
    onToggle: toggle("page"),
    onSelect: () => V.select(null),
    depth: 0,
    bg: "transparent",
    weight: 600,
    color: "#1b2430",
    fs: "11.5px",
  });

  if (!collapsed["page"]) {
    for (const s of S.stack) {
      const secSel = s.id === V.selectedId;
      const itemSel = (lk: string, k: number) =>
        secSel && !!V.selPart && V.selPart.listKey === lk && V.selPart.idx === k && !V.selElemKey;
      const fieldSel = (f: string) => V.selElemKey === s.id + ":" + f;
      const secSelFn = () => {
        V.select(s.id);
        V.scrollToSection(s.id);
      };
      const F = (field: keyof Section, label: string): TreeNode | null =>
        s[field]
          ? { label, sub: '"' + String(s[field]) + '"', sel: () => V.selectField(s.id, field as string), isSel: fieldSel(field as string) }
          : null;
      const W = (label: string, key: string, kids: Array<TreeNode | null>, sub?: string): TreeNode => ({
        label,
        key: s.id + "/" + key,
        kids: kids.filter(Boolean) as TreeNode[],
        wrap: true,
        sub: sub ?? "",
        sel: secSelFn,
      });
      const IT = (lk: "links" | "cards" | "plans" | "faqs" | "fields", label: string, k: number, text: string, kids?: Array<TreeNode | null>): TreeNode => ({
        label,
        sub: '"' + text + '"',
        key: kids && kids.length ? s.id + "/" + lk + k : undefined,
        sel: () => V.selectItem(s.id, lk, k),
        isSel: itemSel(lk, k),
        kids: (kids ?? []).filter(Boolean) as TreeNode[],
      });

      let root: TreeNode | null = null;
      if (s.type === "Navbar")
        root = W("HStack", "r", [
          F("title", "Heading"),
          W("Links", "l", (s.links ?? []).map((l, k) => IT("links", "Link", k, l.t))),
          F("btn1", "Button"),
        ]);
      else if (s.type === "Hero" && s.variant === 0)
        root = W("VStack", "r", [F("badge", "Badge"), F("title", "Heading"), F("sub", "Text"), W("HStack", "b", [F("btn1", "Button"), F("btn2", "Button")])]);
      else if (s.type === "Hero" && s.variant === 1)
        root = W("Grid", "r", [W("VStack", "a", [F("title", "Heading"), F("sub", "Text"), F("btn1", "Button")]), { label: "Image", sub: "product shot", wrap: true }]);
      else if (s.type === "Hero") root = W("VStack", "r", [F("title", "Heading"), F("sub", "Text")]);
      else if (s.type === "Features")
        root = W("VStack", "r", [
          F("title", "Heading"),
          W(
            "Grid",
            "g",
            (s.cards ?? []).map((f, k) =>
              IT("cards", "Card", k, f.t, [
                { label: "Heading", sub: '"' + f.t + '"', sel: () => V.selectItem(s.id, "cards", k) },
                { label: "Text", sub: '"' + f.d + '"', sel: () => V.selectItem(s.id, "cards", k) },
              ]),
            ),
          ),
        ]);
      else if (s.type === "Gallery")
        root = W("VStack", "r", [F("title", "Heading"), W("Grid", "g", Array.from({ length: 6 }, (_, k) => ({ label: "Image", sub: "image " + (k + 1), wrap: true })))]);
      else if (s.type === "Pricing")
        root = W("VStack", "r", [
          F("title", "Heading"),
          W(
            "Grid",
            "g",
            (s.plans ?? []).map((p, k) =>
              IT("plans", "Plan", k, p.tier + " " + p.price, [
                { label: "Tag", sub: '"' + p.tier + '"', sel: () => V.selectItem(s.id, "plans", k) },
                { label: "Price", sub: '"' + p.price + '"', sel: () => V.selectItem(s.id, "plans", k) },
                { label: "Text", sub: '"' + p.d + '"', sel: () => V.selectItem(s.id, "plans", k) },
                { label: "Button", sub: '"' + p.btn + '"', sel: () => V.selectItem(s.id, "plans", k) },
              ]),
            ),
          ),
        ]);
      else if (s.type === "Testimonial")
        root = W("VStack", "r", [{ label: "Quote", sub: '"', wrap: true }, F("sub", "Text"), W("HStack", "a", [{ label: "Avatar", wrap: true }, F("title", "Text")])]);
      else if (s.type === "Form")
        root = W("VStack", "r", [F("title", "Heading"), W("VStack", "f", (s.fields ?? []).map((ff, k) => IT("fields", "Field", k, ff.t))), F("btn1", "Button")]);
      else if (s.type === "Faq")
        root = W("VStack", "r", [F("title", "Heading"), ...(s.faqs ?? []).map((q2, k) => IT("faqs", "Faq", k, q2.t))]);
      else if (s.type === "Cta") root = W("VStack", "r", [F("title", "Heading"), F("sub", "Text"), F("btn1", "Button")]);
      else if (s.type === "Footer")
        root = W("VStack", "r", [
          W("Grid", "g", [
            W("VStack", "b", [F("title", "Heading"), F("sub", "Text")], "Brand"),
            ...(s.cols ?? []).map(
              (c2, ci): TreeNode => ({
                label: "Column",
                sub: '"' + c2.h + '"',
                key: s.id + "/col" + ci,
                sel: () => V.selectItem(s.id, "cols", ci),
                isSel: itemSel("cols", ci),
                kids: [
                  { label: "Heading", sub: '"' + c2.h + '"', sel: () => V.selectItem(s.id, "cols", ci) },
                  ...(c2.items ?? []).map(
                    (t, ii): TreeNode => ({
                      label: "Link",
                      sub: '"' + t + '"',
                      sel: () => V.selectColLink(s.id, ci, ii),
                      isSel: V.selElemKey === s.id + ":cols:" + ci + ":" + ii,
                    }),
                  ),
                ],
              }),
            ),
          ]),
          F("copy", "Text"),
        ]);
      else if (s.type === "Columns") {
        const count = s.variant === 0 ? 2 : s.variant >= 2 ? 1 : 3;
        const cellNodes: TreeNode[] = (s.cards ?? []).slice(0, count).map((f, k) =>
          IT("cards", "Cell", k, f.t, [
            { label: "Heading", sub: '"' + f.t + '"', sel: () => V.selectItem(s.id, "cards", k) },
            { label: "Text", sub: '"' + f.d + '"', sel: () => V.selectItem(s.id, "cards", k) },
          ]),
        );
        if (s.variant === 2) cellNodes.push({ label: "Image", sub: "image", wrap: true });
        if (s.variant === 3) cellNodes.unshift({ label: "Image", sub: "image", wrap: true });
        root = W("Grid", "r", cellNodes);
      } else if (s.type === "Diagram") root = W("VStack", "r", [F("title", "Heading"), { label: "Mermaid", sub: "diagram", wrap: true }]);
      else if (s.type === "Divider") root = W("HStack", "r", s.variant === 2 ? [F("title", "Label")] : [{ label: "Rule", wrap: true }]);
      else if (s.type === "Video") root = W("VStack", "r", [F("title", "Heading"), { label: "Video", sub: "16:9", wrap: true }]);
      else if (s.type === "Banner") root = W("HStack", "r", [F("title", "Text"), F("btn1", "Button")]);
      else if (s.type === "Breadcrumb")
        root = W(
          "HStack",
          "r",
          (s.links ?? []).map((l, k): TreeNode => ({ label: "Crumb", sub: '"' + l.t + '"', sel: () => V.pickPart(s.id, "links", k), isSel: itemSel("links", k) })),
        );
      else root = W("VStack", "r", [F("title", "Heading"), F("sub", "Text"), ...(s.cards ?? []).map((f, k) => IT("cards", "Item", k, f.t))]);

      emit(
        {
          label: s.type,
          sub: '"' + (s.title || CATALOG[s.type].ko) + '"' + (s.vis === "mobile" ? " · 📱 모바일만" : s.vis === "desktop" ? " · 🖥 데스크톱만" : ""),
          key: s.id,
          sel: secSelFn,
          isSel: secSel && !V.selPart && !V.selElemKey,
          w: 600,
          color: "#1b2430",
          fs: "11.5px",
          kids: root ? [root] : [],
        },
        1,
      );
    }
  }

  return (
    <div style={{ flex: 1, borderTop: "1px solid #dde3ea", overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 2, minHeight: 0, background: "#fbfcfd" }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8a94a3", textTransform: "uppercase", letterSpacing: ".06em", paddingBottom: 6 }}>구조 트리</div>
      {rows.map((r, i) => (
        <div key={i} className="hov-treerow" onClick={r.onSelect} style={{ display: "flex", alignItems: "stretch", borderRadius: 6, background: r.bg, cursor: "pointer", width: "100%", minHeight: 24 }}>
          {Array.from({ length: r.depth }, (_, k) => (
            <span key={k} style={{ width: 14, flex: "none", borderLeft: "1px solid #e2e8f0", marginLeft: 7 }} />
          ))}
          <span
            onClick={(e) => {
              if (r.onToggle) {
                e.stopPropagation();
                r.onToggle();
              }
            }}
            style={{ width: 16, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "#a8b1bd", cursor: "pointer" }}
          >
            {r.caret}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, padding: "3px 4px 3px 0" }}>
            <span style={{ fontSize: r.fs, color: r.color, fontWeight: r.weight, flex: "none" }}>{r.label}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#a8b1bd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.sub}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
