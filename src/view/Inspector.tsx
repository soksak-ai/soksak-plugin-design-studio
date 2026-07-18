// 우측 인스펙터 — 선택 없음(페이지 속성: 로고·레이아웃·고정 토글) / 섹션 편집(텍스트·배경·
// 표시 기기·여백·변형) / 부분 편집(플랜·카드·컬럼·텍스트). 입력은 라이브 반영 + blur 커밋.
import { useRef, type CSSProperties } from "react";
import type { PartListKey, Section } from "@/types";
import type { StudioFacade, StudioState } from "@/store";
import { PART_LABELS } from "@/store";
import { CATALOG, padDefaults, updateById, updatePartById } from "@/core/model";
import { FONT_MONO, FONT_SANS } from "@/styles";
import type { ViewApi } from "@/view/common";
import { LOGO_PRESETS } from "@/view/Canvas";

const PALETTE = [
  { name: "White", c: "#ffffff" },
  { name: "Mist", c: "#f4f6f8" },
  { name: "Indigo tint", c: "#eef2ff" },
  { name: "Sand", c: "#faf6ef" },
  { name: "Dark navy", c: "#0f172a" },
];

const label11: CSSProperties = { fontSize: 11, fontWeight: 600, color: "#4a5568" };
const inputBase: CSSProperties = {
  height: 32,
  padding: "0 10px",
  border: "1px solid #dde3ea",
  borderRadius: 8,
  fontFamily: FONT_SANS,
  fontSize: 12,
  color: "#1b2430",
  background: "#fbfcfd",
};

function Field(props: {
  k: string;
  value: string;
  textarea?: boolean;
  rows?: number;
  mono?: boolean;
  onLive: (v: string) => void;
  /** blur 시 최종값으로 1회 확정(명령 1회 = 히스토리 1칸). */
  onCommit: (v: string) => void;
}) {
  const dirty = useRef(false);
  const last = useRef(props.value);
  const common = {
    key: props.k,
    defaultValue: props.value,
    spellCheck: false,
    onChange: (e: { target: { value: string } }) => {
      dirty.current = true;
      last.current = e.target.value;
      props.onLive(e.target.value);
    },
    onBlur: () => {
      if (dirty.current) {
        dirty.current = false;
        props.onCommit(last.current);
      }
    },
  };
  return props.textarea ? (
    <textarea
      {...common}
      rows={props.rows ?? 2}
      style={{ padding: props.mono ? 10 : "8px 10px", border: "1px solid #dde3ea", borderRadius: 8, fontFamily: props.mono ? FONT_MONO : FONT_SANS, fontSize: props.mono ? 10.5 : 11.5, color: "#1b2430", background: "#fbfcfd", resize: "vertical", lineHeight: props.mono ? 1.6 : 1.5 }}
    />
  ) : (
    <input {...common} style={inputBase} />
  );
}

export function InspectorRail({ onExpand }: { onExpand: () => void }) {
  return (
    <div style={{ width: 44, flex: "none", background: "#ffffff", borderLeft: "1px solid #dde3ea", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 0" }}>
      <button
        className="hov-bg"
        title="인스펙터 펼치기"
        onClick={onExpand}
        style={{ width: 30, height: 30, border: "1px solid #dde3ea", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 12, color: "#4a5568" }}
      >
        ⟨
      </button>
      <span title="섹션을 선택하면 속성 패널이 떠서 열립니다" style={{ width: 30, height: 30, display: "grid", placeItems: "center", fontSize: 13, opacity: 0.55 }}>
        ⚙
      </span>
    </div>
  );
}

export function InspectorBody({ S, store, V }: { S: StudioState; store: StudioFacade; V: ViewApi }) {
  const accent = S.accent;
  const isMobile = S.device === "mobile";
  const sel = S.stack.find((s) => s.id === V.selectedId) ?? null;
  const partKind: PartListKey | null = V.selPart?.listKey ?? null;
  const partArr = sel && partKind ? ((sel[partKind] as unknown[] | undefined) ?? []) : [];
  const partSel = sel && V.selPart && partArr[V.selPart.idx] ? (partArr[V.selPart.idx] as Record<string, unknown>) : null;
  const E = S.epoch;

  const liveSec = (patch: Partial<Section>) => {
    if (sel) store.setStackLive(updateById(S.stack, sel.id, patch));
  };
  const livePart = (patch: Record<string, unknown>) => {
    if (sel && V.selPart) store.setStackLive(updatePartById(S.stack, sel.id, V.selPart.listKey, V.selPart.idx, patch));
  };
  const fk = (name: string) => (sel?.id ?? "") + ":" + name + ":" + E + ":" + (V.selPart ? V.selPart.listKey + V.selPart.idx : "");

  // ── 페이지 속성(선택 없음) ──
  if (!sel)
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={label11}>로고</label>
          <div style={{ display: "flex", gap: 4 }}>
            {(
              [
                ["text", "텍스트"],
                ["icon", "아이콘"],
                ["both", "아이콘+텍스트"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => store.setShell({ logoMode: v })}
                style={{ flex: 1, height: 28, border: `1px solid ${S.logoMode === v ? accent : "#e4e9ef"}`, borderRadius: 7, background: S.logoMode === v ? "#eef2ff" : "#fff", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 10.5, color: "#1b2430" }}
              >
                {label}
              </button>
            ))}
          </div>
          {S.logoMode !== "text" ? (
            <>
              <div style={{ display: "flex", gap: 6 }}>
                {LOGO_PRESETS.map((p, k) => (
                  <button
                    key={k}
                    className="hov-line"
                    title={p.name}
                    onClick={() => store.setShell({ logoIcon: k })}
                    style={{ width: 34, height: 34, border: `1.5px solid ${S.logoIcon === k ? accent : "#e4e9ef"}`, borderRadius: 8, background: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <span style={{ width: 16, height: 16, display: "block", borderRadius: p.rad, background: p.bg(accent), transform: p.tf }} />
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#8a94a3", lineHeight: 1.4 }}>기본 제공 컬러 아이콘입니다. 로고 텍스트는 캔버스에서 직접 수정하세요.</div>
            </>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={label11}>페이지 레이아웃</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
            {(
              [
                ["stack", "기본 스택"],
                ["left", "좌측 사이드바"],
                ["right", "우측 사이드바"],
                ["both", "좌+우 사이드바"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                className="hov-line"
                onClick={() => store.setLayout(v)}
                style={{ display: "flex", alignItems: "center", gap: 7, height: 32, padding: "0 10px", border: `1px solid ${S.layout === v ? accent : "#e4e9ef"}`, borderRadius: 8, background: S.layout === v ? "#eef2ff" : "#fff", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 11, color: "#1b2430", textAlign: "left" }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: S.layout === v ? accent : "#d3dbe4", flex: "none" }} />
                {label}
              </button>
            ))}
          </div>
          {S.layout !== "stack" ? (
            <>
              <button
                className="hov-line"
                onClick={() => store.setUiFlags({ sideFixed: !S.sideFixed })}
                style={{ display: "flex", alignItems: "center", gap: 8, height: 32, padding: "0 10px", border: `1px solid ${S.sideFixed ? accent : "#e4e9ef"}`, borderRadius: 8, background: S.sideFixed ? "#eef2ff" : "#fff", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 11, color: "#1b2430", textAlign: "left" }}
              >
                <span style={{ fontWeight: 600, color: S.sideFixed ? accent : "#4a5568" }}>📌 {S.sideFixed ? "ON" : "OFF"}</span>사이드바 고정 (스크롤 시 유지)
              </button>
              <button
                className="hov-line"
                onClick={() => store.setUiFlags({ mobBarFixed: !S.mobBarFixed })}
                style={{ display: "flex", alignItems: "center", gap: 8, height: 32, padding: "0 10px", border: `1px solid ${S.mobBarFixed ? accent : "#e4e9ef"}`, borderRadius: 8, background: S.mobBarFixed ? "#eef2ff" : "#fff", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 11, color: "#1b2430", textAlign: "left" }}
              >
                <span style={{ fontWeight: 600, color: S.mobBarFixed ? accent : "#4a5568" }}>📱 {S.mobBarFixed ? "ON" : "OFF"}</span>모바일 상단 바 고정
              </button>
              <div style={{ fontSize: 10.5, color: "#8a94a3", lineHeight: 1.5 }}>모바일에서는 좌측 사이드바 → 상단 바(☰ 드로어), 우측 레일 → ≣ 드로어로 자동 변환됩니다.</div>
            </>
          ) : null}
        </div>
        <div style={{ padding: "20px 14px", border: "1.5px dashed #dde3ea", borderRadius: 10, textAlign: "center", fontSize: 11.5, color: "#8a94a3", lineHeight: 1.6 }}>
          캔버스에서 섹션을 선택하면
          <br />
          속성을 편집할 수 있습니다.
          <br />
          플랜·카드·링크 등 내부 항목도
          <br />
          직접 클릭해 편집하세요.
        </div>
      </>
    );

  // ── 부분(part) 편집 ──
  if (partSel && partKind && V.selPart) {
    const k = V.selPart.idx;
    const fieldCol = (labelText: string, node: React.ReactNode) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={label11}>{labelText}</label>
        {node}
      </div>
    );
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="hov-bg"
            onClick={() => V.clearPart()}
            style={{ height: 24, padding: "0 9px", border: "1px solid #dde3ea", borderRadius: 6, background: "#fff", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 10.5, color: "#4a5568" }}
          >
            ← 섹션
          </button>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, background: "#eef2ff", color: accent, padding: "3px 8px", borderRadius: 6 }}>
            {PART_LABELS[partKind]} #{k + 1}
          </span>
        </div>

        {partKind === "plans" ? (
          <>
            {fieldCol("플랜 이름", <Field k={fk("tier")} value={String(partSel.tier ?? "")} onLive={(v) => livePart({ tier: v })} onCommit={(v) => store.partUpdate(sel.id, partKind, k, { tier: v }, "플랜 이름 수정")} />)}
            {fieldCol("가격", <Field k={fk("price")} value={String(partSel.price ?? "")} onLive={(v) => livePart({ price: v })} onCommit={(v) => store.partUpdate(sel.id, partKind, k, { price: v }, "가격 수정")} />)}
            {fieldCol("설명", <Field k={fk("d")} value={String(partSel.d ?? "")} textarea rows={2} onLive={(v) => livePart({ d: v })} onCommit={(v) => store.partUpdate(sel.id, partKind, k, { d: v }, "설명 수정")} />)}
            {fieldCol("버튼 텍스트", <Field k={fk("btn")} value={String(partSel.btn ?? "")} onLive={(v) => livePart({ btn: v })} onCommit={(v) => store.partUpdate(sel.id, partKind, k, { btn: v }, "버튼 수정")} />)}
            <button
              onClick={() => store.partUpdate(sel.id, "plans", k, { featured: !partSel.featured }, "추천 플랜 변경")}
              style={{ height: 30, border: `1px solid ${partSel.featured ? accent : "#dde3ea"}`, borderRadius: 8, background: partSel.featured ? "#eef2ff" : "#fff", color: partSel.featured ? accent : "#4a5568", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 11.5, fontWeight: 600 }}
            >
              ★ 추천 플랜으로 강조 {partSel.featured ? "ON" : "OFF"}
            </button>
          </>
        ) : null}

        {partKind === "cards" ? (
          <>
            {fieldCol("카드 제목", <Field k={fk("t")} value={String(partSel.t ?? "")} onLive={(v) => livePart({ t: v })} onCommit={(v) => store.partUpdate(sel.id, partKind, k, { t: v }, "카드 제목 수정")} />)}
            {fieldCol("카드 설명", <Field k={fk("d")} value={String(partSel.d ?? "")} textarea rows={3} onLive={(v) => livePart({ d: v })} onCommit={(v) => store.partUpdate(sel.id, partKind, k, { d: v }, "카드 설명 수정")} />)}
          </>
        ) : null}

        {partKind === "cols" ? (
          <>
            {fieldCol("컬럼 제목", <Field k={fk("h")} value={String(partSel.h ?? "")} onLive={(v) => livePart({ h: v })} onCommit={(v) => store.partUpdate(sel.id, partKind, k, { h: v }, "컬럼 제목 수정")} />)}
            {fieldCol(
              "링크 (한 줄에 하나)",
              <Field
                k={fk("items")}
                value={Array.isArray(partSel.items) ? (partSel.items as string[]).join("\n") : ""}
                textarea
                rows={4}
                onLive={(v) => livePart({ items: v.split("\n") })}
                onCommit={(v) => store.partUpdate(sel.id, partKind, k, { items: v.split("\n") }, "컬럼 링크 수정")}
              />,
            )}
          </>
        ) : null}

        {partKind === "faqs" || partKind === "links" || partKind === "fields" ? (
          fieldCol("텍스트", <Field k={fk("t")} value={String(partSel.t ?? "")} onLive={(v) => livePart({ t: v })} onCommit={(v) => store.partUpdate(sel.id, partKind, k, { t: v }, "텍스트 수정")} />)
        ) : null}

        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="hov-bg"
            title="위로"
            onClick={() => {
              if (k > 0) {
                store.partMove(sel.id, partKind, k, k - 1);
                V.pickPart(sel.id, partKind, k - 1);
              }
            }}
            style={{ width: 34, height: 30, border: "1px solid #dde3ea", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 12, color: "#4a5568" }}
          >
            ↑
          </button>
          <button
            className="hov-bg"
            title="아래로"
            onClick={() => {
              if (k < partArr.length - 1) {
                store.partMove(sel.id, partKind, k, k + 1);
                V.pickPart(sel.id, partKind, k + 1);
              }
            }}
            style={{ width: 34, height: 30, border: "1px solid #dde3ea", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 12, color: "#4a5568" }}
          >
            ↓
          </button>
          <button
            className="hov-bg"
            onClick={() => store.partAdd(sel.id, partKind)}
            style={{ flex: 1, height: 30, border: "1px solid #dde3ea", borderRadius: 8, background: "#fff", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 11.5, color: "#1b2430", fontWeight: 600 }}
          >
            ＋ 추가
          </button>
          <button
            onClick={() => {
              store.partRemove(sel.id, partKind, k);
              V.clearPart();
            }}
            style={{ flex: 1, height: 30, border: "1px solid #f3d1d1", borderRadius: 8, background: "#fff", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 11.5, color: "#c05353", fontWeight: 600 }}
          >
            － 삭제
          </button>
        </div>
      </>
    );
  }

  // ── 섹션 편집 ──
  const cat = CATALOG[sel.type];
  const vis = sel.vis ?? "all";
  const on = { desktop: vis === "all" || vis === "desktop", mobile: vis === "all" || vis === "mobile" };
  const [dy, dx] = padDefaults(sel.type);
  const selPadY = isMobile ? (sel.padYM ?? sel.padY ?? dy) : (sel.padY ?? dy);
  const selPadX = isMobile ? (sel.padXM ?? Math.min(sel.padX ?? dx, 18)) : (sel.padX ?? dx);
  const hasSub = (sel.sub !== undefined && sel.sub !== "") || ["Hero", "Testimonial", "Cta", "Footer"].includes(sel.type);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, background: "#eef1f4", color: "#4a5568", padding: "3px 8px", borderRadius: 6 }}>{sel.type}</span>
        <span style={{ fontSize: 11, color: "#8a94a3" }}>{cat.variants[sel.variant] ?? ""}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={label11}>제목 텍스트</label>
        <Field k={fk("title")} value={sel.title ?? ""} onLive={(v) => liveSec({ title: v })} onCommit={(v) => store.sectionUpdate(sel.id, { title: v }, "텍스트 수정")} />
      </div>

      {sel.type === "Diagram" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={label11}>Mermaid 코드</label>
          <Field k={fk("code")} value={sel.code ?? ""} textarea rows={7} mono onLive={(v) => liveSec({ code: v })} onCommit={(v) => store.sectionUpdate(sel.id, { code: v }, "다이어그램 수정")} />
          <div style={{ fontSize: 10, color: "#8a94a3", lineHeight: 1.5 }}>flowchart · sequenceDiagram · classDiagram 등 Mermaid 문법 지원</div>
        </div>
      ) : null}

      {hasSub ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={label11}>보조 텍스트</label>
          <Field k={fk("sub")} value={sel.sub ?? ""} textarea rows={2} onLive={(v) => liveSec({ sub: v })} onCommit={(v) => store.sectionUpdate(sel.id, { sub: v }, "텍스트 수정")} />
        </div>
      ) : null}

      {sel.btn1 !== undefined ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={label11}>주 버튼 텍스트</label>
          <Field k={fk("btn1")} value={sel.btn1} onLive={(v) => liveSec({ btn1: v })} onCommit={(v) => store.sectionUpdate(sel.id, { btn1: v }, "버튼 텍스트 수정")} />
        </div>
      ) : null}
      {sel.btn2 !== undefined ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={label11}>보조 버튼 텍스트</label>
          <Field k={fk("btn2")} value={sel.btn2} onLive={(v) => liveSec({ btn2: v })} onCommit={(v) => store.sectionUpdate(sel.id, { btn2: v }, "버튼 텍스트 수정")} />
        </div>
      ) : null}
      {sel.badge !== undefined ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={label11}>배지 텍스트</label>
          <Field k={fk("badge")} value={sel.badge} onLive={(v) => liveSec({ badge: v })} onCommit={(v) => store.sectionUpdate(sel.id, { badge: v }, "배지 수정")} />
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={label11}>배경</label>
        <div style={{ display: "flex", gap: 6 }}>
          {PALETTE.map((w) => (
            <button
              key={w.c}
              title={w.name}
              onClick={() => store.sectionUpdate(sel.id, { bg: w.c }, "배경 변경")}
              style={{ width: 30, height: 30, borderRadius: 8, background: w.c, border: sel.bg === w.c ? `2px solid ${accent}` : "1px solid #dde3ea", cursor: "pointer" }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={label11}>표시 기기</label>
        <div style={{ display: "flex", gap: 4 }}>
          {(
            [
              ["desktop", "🖥 Desktop"],
              ["mobile", "📱 Mobile"],
            ] as const
          ).map(([v, labelText]) => {
            const checked = on[v];
            const other = v === "desktop" ? "mobile" : "desktop";
            return (
              <button
                key={v}
                onClick={() => {
                  if (checked && !on[other]) return;
                  const next = { desktop: on.desktop, mobile: on.mobile, [v]: !checked } as { desktop: boolean; mobile: boolean };
                  const nv = next.desktop && next.mobile ? "all" : next.desktop ? "desktop" : "mobile";
                  store.sectionUpdate(sel.id, { vis: nv }, "표시 기기: " + (nv === "all" ? "모두" : nv === "desktop" ? "데스크톱만" : "모바일만"));
                }}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 30, border: `1px solid ${checked ? accent : "#e4e9ef"}`, borderRadius: 7, background: checked ? "#eef2ff" : "#fff", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 11, fontWeight: 500, color: "#1b2430" }}
              >
                <span style={{ width: 14, height: 14, flex: "none", border: `1.5px solid ${checked ? accent : "#c7cfd8"}`, borderRadius: 4, background: checked ? accent : "#fff", display: "grid", placeItems: "center", color: "#fff", fontSize: 10, lineHeight: 1 }}>
                  {checked ? "✓" : ""}
                </span>
                <span>{labelText}</span>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: "#8a94a3", lineHeight: 1.4 }}>체크된 기기에서만 이 섹션이 표시됩니다. 최소 하나는 선택되어야 합니다.</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={label11}>
          여백 · <span style={{ color: accent }}>{isMobile ? "Mobile" : "Desktop"}</span>
        </label>
        <div style={{ fontSize: 10, color: "#8a94a3", lineHeight: 1.4 }}>현재 미리보기 기기의 여백을 조정합니다. Desktop/Mobile 각각 따로 저장됩니다.</div>
        {(
          [
            ["상하", selPadY, (v: number) => (isMobile ? { padYM: v } : { padY: v })],
            ["좌우", selPadX, (v: number) => (isMobile ? { padXM: v } : { padX: v })],
          ] as const
        ).map(([labelText, value, patchOf]) => (
          <div key={labelText} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: "#8a94a3", width: 26, flex: "none" }}>{labelText}</span>
            <input
              type="range"
              min={0}
              max={120}
              step={2}
              value={value}
              onChange={(e) => liveSec(patchOf(Number(e.target.value)))}
              onPointerUp={() => store.sectionUpdate(sel.id, isMobile ? { padYM: selPadY, padXM: selPadX } : { padY: selPadY, padX: selPadX }, "여백 조정")}
              style={{ flex: 1, accentColor: accent }}
            />
            <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: "#4a5568", width: 32, textAlign: "right", flex: "none" }}>{value}px</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={label11}>변형 (부분 교체)</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {cat.variants.map((v, vi) => (
            <button
              key={vi}
              className="hov-line"
              onClick={() => store.sectionSwap(sel.id, vi)}
              style={{ display: "flex", alignItems: "center", gap: 8, height: 30, padding: "0 10px", border: `1px solid ${vi === sel.variant ? accent : "#e4e9ef"}`, borderRadius: 8, background: vi === sel.variant ? "#eef2ff" : "#ffffff", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 11.5, color: "#1b2430", textAlign: "left" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: vi === sel.variant ? accent : "#d3dbe4", flex: "none" }} />
              {v}
            </button>
          ))}
        </div>
      </div>

      {sel.plans || sel.cards || sel.faqs || sel.links || sel.fields ? (
        <div style={{ padding: "10px 12px", border: "1px solid #e4e9ef", borderRadius: 9, background: "#fbfcfd", fontSize: 11, color: "#6b7686", lineHeight: 1.55 }}>
          💡 캔버스에서 <b>플랜·카드·항목을 직접 클릭</b>하면 개별 상세를 편집할 수 있습니다.
        </div>
      ) : null}
    </>
  );
}
