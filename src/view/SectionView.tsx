// 섹션 렌더러 — 23종 타입×변형 마크업. 선택 오버레이·툴바·＋피커·
// 드래그 재정렬·인라인 편집(part ring 포함)까지 섹션 하나의 표면 전부를 소유한다.
import type { CSSProperties, DragEvent, MouseEvent } from "react";
import type { CardItem, FieldItem, FootCol, PlanItem, Section, TextItem } from "@/types";
import type { StudioFacade, StudioState } from "@/store";
import { CATALOG, SECTION_TYPES, colorsFor, darkBg, padDefaults } from "@/core/model";
import { FONT_MONO, FONT_SANS } from "@/styles";
import { Editable, stop, useExportMode, type ViewApi } from "@/view/common";
import { ImageSlot } from "@/view/ImageSlot";
import { Mermaid } from "@/view/Mermaid";

interface Props {
  s: Section;
  /** visibleStack 내 인덱스(드롭존 활성 판정). */
  i: number;
  S: StudioState;
  store: StudioFacade;
  V: ViewApi;
}

export function SectionView({ s, i, S, store, V }: Props) {
  const exportMode = useExportMode();
  const accent = S.accent;
  const cat = CATALOG[s.type];
  const isMobile = S.device === "mobile";
  const pageDark = S.pageDark;
  const effBg = pageDark ? darkBg(s.bg) : s.bg;
  const dk = pageDark || s.bg === "#0f172a";
  const c = colorsFor(effBg, pageDark);
  const selected = s.id === V.selectedId;
  const E = S.epoch;
  const vname = cat.variants[s.variant] ?? cat.variants[0];
  const dzActive = V.dragPayload != null && V.dropIdx === i;
  const addDragging = V.dragPayload?.kind === "add";

  const elemRing = (key: string) => (V.selElemKey === key ? `0 0 0 2px ${accent}` : "none");
  const partRing = (listKey: string, k: number) =>
    V.selectedId === s.id && V.selPart && V.selPart.listKey === listKey && V.selPart.idx === k && !V.selElemKey
      ? `0 0 0 2px ${accent}`
      : "none";

  const editSec = (patch: Partial<Section>, label: string) => store.sectionUpdate(s.id, patch, label);
  const editPart = (listKey: "links" | "cards" | "plans" | "faqs" | "fields" | "cols", k: number, patch: Record<string, unknown>, label: string) =>
    store.partUpdate(s.id, listKey, k, patch, label);
  const setImage = (slot: string, url: string) =>
    store.sectionUpdate(s.id, { images: { ...(s.images ?? {}), [slot]: url } }, "이미지 추가");

  const pad = (() => {
    const [dy, dx] = padDefaults(s.type);
    const dPy = s.padY ?? dy;
    const dPx = s.padX ?? dx;
    const py = isMobile ? (s.padYM ?? dPy) : dPy;
    const px = isMobile ? (s.padXM ?? Math.min(dPx, 18)) : dPx;
    return `${py}px ${px}px`;
  })();

  const cardsSrc = s.cards ?? [];
  const visCards =
    s.type === "Stats" && s.variant === 1
      ? cardsSrc.slice(0, 3)
      : s.type === "Features" && s.variant === 1
        ? cardsSrc.slice(0, 2)
        : s.type === "Columns" && s.variant === 0
          ? cardsSrc.slice(0, 2)
          : s.type === "Columns" && s.variant >= 2
            ? cardsSrc.slice(0, 1)
            : cardsSrc;
  const plansSrc = s.plans ?? [];
  const visPlans = s.type === "Pricing" && s.variant === 1 ? plansSrc.slice(0, 2) : plansSrc;

  const fullIdx = () => S.stack.findIndex((x) => x.id === s.id);
  const pickerOpen = (() => {
    const ri = fullIdx();
    return selected && (V.addAt === ri || V.addAt === ri + 1);
  })();

  const onOverSection = (e: DragEvent) => {
    const p = V.dragPayload;
    if (!p || p.kind !== "move") return;
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = "move";
    } catch {
      /* noop */
    }
    if (p.id === s.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    V.reorderOver(s.id, e.clientY - rect.top < rect.height / 2);
  };

  const mono9 = (extra?: CSSProperties): CSSProperties => ({ fontFamily: FONT_MONO, ...extra });

  // ── 타입별 콘텐츠 ──
  const content = () => {
    if (s.type === "Navbar")
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: accent }} />
            <Editable
              k={s.id + "t" + E} node={"edit/" + s.id + "/title"}
              text={s.title ?? ""}
              onCommit={(v) => editSec({ title: v }, "텍스트 수정")}
              style={{ fontWeight: 700, fontSize: 14, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":title") }}
            />
          </div>
          {!isMobile ? (
            <>
              <div
                style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: "4px 14px", justifyContent: "center", fontSize: 12, color: c.muted }}
              >
                {(s.links ?? []).map((l, k) => (
                  <Editable
                    key={s.id + "l" + k + "_" + E}
                    k={s.id + "l" + k + "_" + E}
                    text={l.t}
                    onClick={(e) => {
                      e.stopPropagation();
                      V.pickPart(s.id, "links", k);
                    }}
                    onCommit={(v) => editPart("links", k, { t: v }, "링크 수정")}
                    style={{ cursor: "text", padding: "3px 6px", borderRadius: 5, boxShadow: partRing("links", k) }}
                  />
                ))}
              </div>
              <Editable
                tag="button"
                k={s.id + "b1" + E} node={"edit/" + s.id + "/btn1"}
                text={s.btn1 ?? ""}
                onCommit={(v) => editSec({ btn1: v }, "버튼 텍스트 수정")}
                style={{
                  flex: "none",
                  height: 28,
                  padding: "0 14px",
                  border: "none",
                  borderRadius: 7,
                  background: accent,
                  color: "#fff",
                  fontFamily: FONT_SANS,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "text",
                  boxShadow: elemRing(s.id + ":btn1"),
                }}
              />
            </>
          ) : (
            <>
              <span style={{ flex: 1 }} />
              <button
                style={{
                  width: 34,
                  height: 30,
                  border: `1px solid ${c.line}`,
                  borderRadius: 7,
                  background: "transparent",
                  color: c.fg,
                  cursor: "pointer",
                  fontSize: 14,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                ☰
              </button>
            </>
          )}
        </div>
      );

    if (s.type === "Hero" && s.variant === 0)
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
          <Editable
            k={s.id + "bd" + E} node={"edit/" + s.id + "/badge"}
            text={s.badge ?? ""}
            onCommit={(v) => editSec({ badge: v }, "배지 수정")}
            style={mono9({ fontSize: 10.5, color: accent, letterSpacing: ".08em", textTransform: "uppercase", cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":badge") })}
          />
          <Editable
            tag="h1"
            k={s.id + "t" + E} node={"edit/" + s.id + "/title"}
            text={s.title ?? ""}
            onCommit={(v) => editSec({ title: v }, "텍스트 수정")}
            style={{ margin: 0, fontSize: "clamp(22px,4vw,38px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: 560, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":title") }}
          />
          <Editable
            tag="p"
            k={s.id + "s" + E} node={"edit/" + s.id + "/sub"}
            text={s.sub ?? ""}
            onCommit={(v) => editSec({ sub: v }, "텍스트 수정")}
            style={{ margin: 0, fontSize: 14, color: c.muted, maxWidth: 440, lineHeight: 1.6, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":sub") }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <Editable
              tag="button"
              k={s.id + "b1" + E} node={"edit/" + s.id + "/btn1"}
              text={s.btn1 ?? ""}
              onCommit={(v) => editSec({ btn1: v }, "버튼 텍스트 수정")}
              style={{ height: 36, padding: "0 20px", border: "none", borderRadius: 8, background: accent, color: "#fff", fontFamily: FONT_SANS, fontSize: 12.5, fontWeight: 600, cursor: "text", boxShadow: elemRing(s.id + ":btn1") }}
            />
            <Editable
              tag="button"
              k={s.id + "b2" + E} node={"edit/" + s.id + "/btn2"}
              text={s.btn2 ?? ""}
              onCommit={(v) => editSec({ btn2: v }, "버튼 텍스트 수정")}
              style={{ height: 36, padding: "0 20px", border: `1px solid ${c.line}`, borderRadius: 8, background: "transparent", color: c.fg, fontFamily: FONT_SANS, fontSize: 12.5, fontWeight: 600, cursor: "text", boxShadow: elemRing(s.id + ":btn2") }}
            />
          </div>
        </div>
      );

    if (s.type === "Hero" && s.variant === 1)
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 28, alignItems: "center", textAlign: "left" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Editable
              tag="h1"
              k={s.id + "t" + E} node={"edit/" + s.id + "/title"}
              text={s.title ?? ""}
              onCommit={(v) => editSec({ title: v }, "텍스트 수정")}
              style={{ margin: 0, fontSize: "clamp(20px,3.4vw,32px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.18, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":title") }}
            />
            <Editable
              tag="p"
              k={s.id + "s" + E} node={"edit/" + s.id + "/sub"}
              text={s.sub ?? ""}
              onCommit={(v) => editSec({ sub: v }, "텍스트 수정")}
              style={{ margin: 0, fontSize: 13.5, color: c.muted, lineHeight: 1.6, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":sub") }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Editable
                tag="button"
                k={s.id + "b1" + E} node={"edit/" + s.id + "/btn1"}
                text={s.btn1 ?? ""}
                onCommit={(v) => editSec({ btn1: v }, "버튼 텍스트 수정")}
                style={{ height: 34, padding: "0 18px", border: "none", borderRadius: 8, background: accent, color: "#fff", fontFamily: FONT_SANS, fontSize: 12, fontWeight: 600, cursor: "text", boxShadow: elemRing(s.id + ":btn1") }}
              />
            </div>
          </div>
          <div style={{ aspectRatio: "4/3" }}>
            <ImageSlot node={"img/" + s.id + "/hero"} src={s.images?.hero} placeholder="product shot — 이미지를 드래그하세요" radius={10} dark={dk} onImage={(u) => setImage("hero", u)} />
          </div>
        </div>
      );

    if (s.type === "Hero")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left", maxWidth: 620 }}>
          <Editable
            tag="h1"
            k={s.id + "t" + E} node={"edit/" + s.id + "/title"}
            text={s.title ?? ""}
            onCommit={(v) => editSec({ title: v }, "텍스트 수정")}
            style={{ margin: 0, fontSize: "clamp(20px,3.2vw,30px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":title") }}
          />
          <Editable
            tag="p"
            k={s.id + "s" + E} node={"edit/" + s.id + "/sub"}
            text={s.sub ?? ""}
            onCommit={(v) => editSec({ sub: v }, "텍스트 수정")}
            style={{ margin: 0, fontSize: 13.5, color: c.muted, lineHeight: 1.6, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":sub") }}
          />
        </div>
      );

    const cardT = (f: CardItem, k: number, style: CSSProperties) => (
      <Editable k={s.id + "ct" + k + "_" + E} text={f.t} onCommit={(v) => editPart("cards", k, { t: v }, "카드 제목 수정")} style={style} />
    );
    const cardD = (f: CardItem, k: number, style: CSSProperties) => (
      <Editable k={s.id + "cd" + k + "_" + E} text={f.d} onCommit={(v) => editPart("cards", k, { d: v }, "카드 설명 수정")} style={style} />
    );
    const h2Title = (style?: CSSProperties) => (
      <Editable
        tag="h2"
        k={s.id + "t" + E} node={"edit/" + s.id + "/title"}
        text={s.title ?? ""}
        onCommit={(v) => editSec({ title: v }, "텍스트 수정")}
        style={{ margin: 0, fontSize: 20, fontWeight: 700, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":title"), ...style }}
      />
    );

    if (s.type === "Features")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {h2Title({ letterSpacing: "-0.01em" })}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
            {visCards.map((f, k) => (
              <div
                key={k}
                onClick={(e) => {
                  e.stopPropagation();
                  V.pickPart(s.id, "cards", k);
                }}
                style={{ padding: 16, border: `1px solid ${c.line}`, borderRadius: 10, background: c.cardBg, display: "flex", flexDirection: "column", gap: 8, textAlign: "left", cursor: "pointer", boxShadow: partRing("cards", k) }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: accent, display: "grid", placeItems: "center", fontSize: 12, color: "#fff", fontWeight: 700 }}>{k + 1}</div>
                {cardT(f, k, { fontSize: 13, fontWeight: 600, cursor: "text" })}
                {cardD(f, k, { fontSize: 11.5, color: c.muted, lineHeight: 1.5, cursor: "text" })}
              </div>
            ))}
          </div>
        </div>
      );

    if (s.type === "Gallery")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {h2Title()}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
            {Array.from({ length: 6 }, (_, k) => (
              <div key={k} style={{ aspectRatio: "1" }}>
                <ImageSlot node={"img/" + s.id + "/g" + k} src={s.images?.["g" + k]} placeholder={"image " + (k + 1)} radius={8} dark={dk} onImage={(u) => setImage("g" + k, u)} />
              </div>
            ))}
          </div>
        </div>
      );

    if (s.type === "Stats")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {h2Title({ textAlign: "center" })}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 14, textAlign: "center" }}>
            {visCards.map((f, k) => (
              <div
                key={k}
                onClick={(e) => {
                  e.stopPropagation();
                  V.pickPart(s.id, "cards", k);
                }}
                style={{ display: "flex", flexDirection: "column", gap: 4, cursor: "pointer", borderRadius: 8, padding: "10px 6px", boxShadow: partRing("cards", k) }}
              >
                {cardT(f, k, { fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: accent, cursor: "text" })}
                {cardD(f, k, { fontSize: 11.5, color: c.muted, cursor: "text" })}
              </div>
            ))}
          </div>
        </div>
      );

    if (s.type === "Logos")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <Editable
            k={s.id + "t" + E} node={"edit/" + s.id + "/title"}
            text={s.title ?? ""}
            onCommit={(v) => editSec({ title: v }, "텍스트 수정")}
            style={{ fontSize: 11.5, fontWeight: 600, color: c.muted, letterSpacing: ".04em", cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":title") }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {visCards.map((f, k) => (
              <Editable
                key={s.id + "ct" + k + "_" + E}
                k={s.id + "ct" + k + "_" + E}
                text={f.t}
                onClick={(e) => {
                  e.stopPropagation();
                  V.pickPart(s.id, "cards", k);
                }}
                onCommit={(v) => editPart("cards", k, { t: v }, "카드 제목 수정")}
                style={{ padding: "9px 20px", border: `1px solid ${c.line}`, borderRadius: 9, fontWeight: 700, fontSize: 13, color: c.muted, letterSpacing: ".02em", cursor: "text", boxShadow: partRing("cards", k) }}
              />
            ))}
          </div>
        </div>
      );

    if (s.type === "Team")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {h2Title({ textAlign: "center" })}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 14, textAlign: "center" }}>
            {visCards.map((f, k) => (
              <div
                key={k}
                onClick={(e) => {
                  e.stopPropagation();
                  V.pickPart(s.id, "cards", k);
                }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", borderRadius: 10, padding: "12px 8px", boxShadow: partRing("cards", k) }}
              >
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#d3dbe4" }} />
                {cardT(f, k, { fontSize: 13, fontWeight: 600, cursor: "text" })}
                {cardD(f, k, { fontSize: 11, color: c.muted, cursor: "text" })}
              </div>
            ))}
          </div>
        </div>
      );

    if (s.type === "Steps")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {h2Title({ textAlign: "center" })}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 18 }}>
            {visCards.map((f, k) => (
              <div
                key={k}
                onClick={(e) => {
                  e.stopPropagation();
                  V.pickPart(s.id, "cards", k);
                }}
                style={{ display: "flex", flexDirection: "column", gap: 8, cursor: "pointer", borderRadius: 10, padding: 8, boxShadow: partRing("cards", k) }}
              >
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: accent, color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 }}>{k + 1}</div>
                {cardT(f, k, { fontSize: 14, fontWeight: 600, cursor: "text" })}
                {cardD(f, k, { fontSize: 11.5, color: c.muted, lineHeight: 1.5, cursor: "text" })}
              </div>
            ))}
          </div>
        </div>
      );

    if (s.type === "Video")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {h2Title({ textAlign: "center" })}
          <div style={{ aspectRatio: "16/9", position: "relative" }}>
            <ImageSlot node={"img/" + s.id + "/vid"} src={s.images?.vid} placeholder="비디오 썸네일을 드래그하세요" radius={12} dark={dk} onImage={(u) => setImage("vid", u)} />
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(15,23,42,.55)", display: "grid", placeItems: "center", color: "#fff", fontSize: 16, paddingLeft: 4 }}>▶</div>
            </div>
          </div>
        </div>
      );

    if (s.type === "Blog")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {h2Title()}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
            {visCards.map((f, k) => (
              <div
                key={k}
                onClick={(e) => {
                  e.stopPropagation();
                  V.pickPart(s.id, "cards", k);
                }}
                style={{ display: "flex", flexDirection: "column", gap: 9, cursor: "pointer", border: `1px solid ${c.line}`, borderRadius: 10, overflow: "hidden", background: c.cardBg, boxShadow: partRing("cards", k) }}
              >
                <div style={{ aspectRatio: "16/9" }}>
                  <ImageSlot node={"img/" + s.id + "/b" + (k + 1)} src={s.images?.["b" + (k + 1)]} placeholder="썸네일" dark={dk} onImage={(u) => setImage("b" + (k + 1), u)} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "0 14px 14px" }}>
                  {cardT(f, k, { fontSize: 13, fontWeight: 600, cursor: "text" })}
                  {cardD(f, k, { fontSize: 11.5, color: c.muted, lineHeight: 1.5, cursor: "text" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    if (s.type === "Banner")
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <Editable
            k={s.id + "t" + E} node={"edit/" + s.id + "/title"}
            text={s.title ?? ""}
            onCommit={(v) => editSec({ title: v }, "텍스트 수정")}
            style={{ fontSize: 13, fontWeight: 600, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":title") }}
          />
          <Editable
            tag="button"
            k={s.id + "b1" + E} node={"edit/" + s.id + "/btn1"}
            text={s.btn1 ?? ""}
            onCommit={(v) => editSec({ btn1: v }, "버튼 텍스트 수정")}
            style={{ height: 28, padding: "0 14px", border: "none", borderRadius: 7, background: accent, color: "#fff", fontFamily: FONT_SANS, fontSize: 11.5, fontWeight: 600, cursor: "text", boxShadow: elemRing(s.id + ":btn1") }}
          />
        </div>
      );

    if (s.type === "Breadcrumb")
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: c.muted }}>
          {(s.links ?? []).map((l, k, arr) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Editable
                k={s.id + "bc" + k + "_" + E}
                text={l.t}
                onClick={(e) => {
                  e.stopPropagation();
                  V.pickPart(s.id, "links", k);
                }}
                onCommit={(v) => editPart("links", k, { t: v }, "경로 수정")}
                style={{
                  cursor: "text",
                  padding: "3px 5px",
                  borderRadius: 5,
                  boxShadow: partRing("links", k),
                  color: k === arr.length - 1 ? (dk ? "#e6ecf5" : "#1b2430") : c.muted,
                  fontWeight: k === arr.length - 1 ? 600 : 400,
                }}
              />
              {k < arr.length - 1 ? <span style={{ color: c.line, fontSize: 11 }}>›</span> : null}
            </span>
          ))}
        </div>
      );

    if (s.type === "Table")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {h2Title({ fontSize: 18 })}
          <div style={{ border: `1px solid ${c.line}`, borderRadius: 10, overflow: "hidden" }}>
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 170px", padding: "9px 14px", background: c.cardBg, fontSize: 10.5, fontWeight: 600, color: c.muted, borderBottom: `1px solid ${c.line}`, textTransform: "uppercase", letterSpacing: ".05em" }}
            >
              <span>항목</span>
              <span>상태 · 담당</span>
            </div>
            {visCards.map((f, k) => (
              <div
                key={k}
                onClick={(e) => {
                  e.stopPropagation();
                  V.pickPart(s.id, "cards", k);
                }}
                style={{ display: "grid", gridTemplateColumns: "1fr 170px", alignItems: "center", padding: "11px 14px", borderBottom: `1px solid ${c.line}`, cursor: "pointer", boxShadow: partRing("cards", k) }}
              >
                {cardT(f, k, { fontSize: 12.5, fontWeight: 600, cursor: "text" })}
                {cardD(f, k, { fontSize: 11.5, color: c.muted, cursor: "text" })}
              </div>
            ))}
          </div>
        </div>
      );

    if (s.type === "List")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {h2Title({ fontSize: 18 })}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {visCards.map((f, k) => (
              <div
                key={k}
                onClick={(e) => {
                  e.stopPropagation();
                  V.pickPart(s.id, "cards", k);
                }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 6px", borderBottom: `1px solid ${c.line}`, cursor: "pointer", boxShadow: partRing("cards", k) }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#d3dbe4", flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  {cardT(f, k, { fontSize: 12.5, fontWeight: 600, cursor: "text" })}
                  {cardD(f, k, { fontSize: 11, color: c.muted, cursor: "text" })}
                </div>
                <span style={{ color: c.muted, fontSize: 13 }}>›</span>
              </div>
            ))}
          </div>
        </div>
      );

    if (s.type === "Testimonial" && s.variant === 1)
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
          {visCards.map((f, k) => (
            <div
              key={k}
              onClick={(e) => {
                e.stopPropagation();
                V.pickPart(s.id, "cards", k);
              }}
              style={{ padding: 16, border: `1px solid ${c.line}`, borderRadius: 10, background: c.cardBg, display: "flex", flexDirection: "column", gap: 8, cursor: "pointer", boxShadow: partRing("cards", k) }}
            >
              <span style={{ fontSize: 22, color: accent, lineHeight: 1 }}>"</span>
              {cardD(f, k, { fontSize: 12, lineHeight: 1.6, cursor: "text" })}
              {cardT(f, k, { fontSize: 11, color: c.muted, fontWeight: 600, cursor: "text" })}
            </div>
          ))}
        </div>
      );

    if (s.type === "Testimonial")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: 26, color: accent, lineHeight: 1 }}>"</div>
          <Editable
            tag="p"
            k={s.id + "s" + E} node={"edit/" + s.id + "/sub"}
            text={s.sub ?? ""}
            onCommit={(v) => editSec({ sub: v }, "텍스트 수정")}
            style={{ margin: 0, fontSize: 15, lineHeight: 1.65, maxWidth: 520, fontWeight: 500, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":sub") }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#d3dbe4" }} />
            <Editable
              k={s.id + "t" + E} node={"edit/" + s.id + "/title"}
              text={s.title ?? ""}
              onCommit={(v) => editSec({ title: v }, "텍스트 수정")}
              style={{ fontSize: 12, color: c.muted, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":title") }}
            />
          </div>
        </div>
      );

    if (s.type === "Pricing")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {h2Title({ textAlign: "center" })}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
            {visPlans.map((p: PlanItem, k: number) => (
              <div
                key={k}
                onClick={(e) => {
                  e.stopPropagation();
                  V.pickPart(s.id, "plans", k);
                }}
                style={{
                  padding: "18px 16px",
                  border: `1px solid ${p.featured ? accent : c.line}`,
                  borderRadius: 12,
                  background: c.cardBg,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  textAlign: "left",
                  boxShadow: partRing("plans", k) !== "none" ? `0 0 0 2px ${accent}` : p.featured ? "0 8px 20px rgba(42,111,219,.15)" : "none",
                  cursor: "pointer",
                }}
              >
                <Editable
                  k={s.id + "pt" + k + "_" + E}
                  text={p.tier}
                  onCommit={(v) => editPart("plans", k, { tier: v }, "플랜 이름 수정")}
                  style={{ fontSize: 11, fontWeight: 600, color: p.featured ? accent : c.muted, textTransform: "uppercase", letterSpacing: ".05em", cursor: "text" }}
                />
                <span style={{ fontSize: 22, fontWeight: 700 }}>
                  <Editable k={s.id + "pp" + k + "_" + E} text={p.price} onCommit={(v) => editPart("plans", k, { price: v }, "가격 수정")} style={{ cursor: "text" }} />
                  <span style={{ fontSize: 11, fontWeight: 400, color: c.muted }}>/mo</span>
                </span>
                <Editable
                  k={s.id + "pd" + k + "_" + E}
                  text={p.d}
                  onCommit={(v) => editPart("plans", k, { d: v }, "플랜 설명 수정")}
                  style={{ fontSize: 11, color: c.muted, lineHeight: 1.5, cursor: "text" }}
                />
                <Editable
                  tag="button"
                  k={s.id + "pb" + k + "_" + E}
                  text={p.btn}
                  onCommit={(v) => editPart("plans", k, { btn: v }, "플랜 버튼 수정")}
                  style={{
                    marginTop: 4,
                    height: 30,
                    border: "none",
                    borderRadius: 7,
                    background: p.featured ? accent : dk ? "rgba(255,255,255,.12)" : "#eef1f4",
                    color: p.featured ? "#fff" : dk ? "#e6ecf5" : "#1b2430",
                    fontFamily: FONT_SANS,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "text",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      );

    if (s.type === "Form")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 440, margin: "0 auto", textAlign: "left" }}>
          {h2Title({ fontSize: 19, textAlign: "center" })}
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {(s.fields ?? []).map((ff: FieldItem, k: number) => (
              <Editable
                tag="div"
                key={s.id + "ff" + k + "_" + E}
                k={s.id + "ff" + k + "_" + E}
                text={ff.t}
                onClick={(e) => {
                  e.stopPropagation();
                  V.pickPart(s.id, "fields", k);
                }}
                onCommit={(v) => editPart("fields", k, { t: v }, "필드 수정")}
                style={{
                  minHeight: ff.tall ? 72 : 36,
                  border: `1px solid ${c.line}`,
                  borderRadius: 8,
                  background: c.cardBg,
                  display: "flex",
                  alignItems: ff.tall ? "flex-start" : "center",
                  padding: "8px 12px",
                  fontSize: 12,
                  color: c.muted,
                  cursor: "text",
                  boxShadow: partRing("fields", k),
                }}
              />
            ))}
          </div>
          <Editable
            tag="button"
            k={s.id + "b1" + E} node={"edit/" + s.id + "/btn1"}
            text={s.btn1 ?? ""}
            onCommit={(v) => editSec({ btn1: v }, "버튼 텍스트 수정")}
            style={{ height: 36, border: "none", borderRadius: 8, background: accent, color: "#fff", fontFamily: FONT_SANS, fontSize: 12.5, fontWeight: 600, cursor: "text", boxShadow: elemRing(s.id + ":btn1") }}
          />
        </div>
      );

    if (s.type === "Faq")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560, margin: "0 auto", textAlign: "left" }}>
          {h2Title({ fontSize: 19, textAlign: "center", margin: "0 0 4px" })}
          {(s.faqs ?? []).map((q: TextItem, k: number) => (
            <div
              key={k}
              onClick={(e) => {
                e.stopPropagation();
                V.pickPart(s.id, "faqs", k);
              }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", border: `1px solid ${c.line}`, borderRadius: 9, background: c.cardBg, cursor: "pointer", boxShadow: partRing("faqs", k) }}
            >
              <Editable k={s.id + "q" + k + "_" + E} text={q.t} onCommit={(v) => editPart("faqs", k, { t: v }, "FAQ 수정")} style={{ fontSize: 12.5, fontWeight: 500, cursor: "text" }} />
              <span style={{ color: c.muted, fontSize: 12 }}>+</span>
            </div>
          ))}
        </div>
      );

    if (s.type === "Cta") {
      const invert = s.variant === 1;
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
          <Editable
            tag="h2"
            k={s.id + "t" + E} node={"edit/" + s.id + "/title"}
            text={s.title ?? ""}
            onCommit={(v) => editSec({ title: v }, "텍스트 수정")}
            style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":title") }}
          />
          <Editable
            tag="p"
            k={s.id + "s" + E} node={"edit/" + s.id + "/sub"}
            text={s.sub ?? ""}
            onCommit={(v) => editSec({ sub: v }, "텍스트 수정")}
            style={{ margin: 0, fontSize: 13, color: c.muted, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":sub") }}
          />
          <Editable
            tag="button"
            k={s.id + "b1" + E} node={"edit/" + s.id + "/btn1"}
            text={s.btn1 ?? ""}
            onCommit={(v) => editSec({ btn1: v }, "버튼 텍스트 수정")}
            style={{ height: 38, padding: "0 24px", border: "none", borderRadius: 9, background: invert ? accent : "#1b2430", color: "#ffffff", fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, cursor: "text", boxShadow: elemRing(s.id + ":btn1") }}
          />
        </div>
      );
    }

    if (s.type === "Diagram")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {h2Title({ textAlign: "center" })}
          <Mermaid code={s.code ?? ""} dark={dk} />
        </div>
      );

    if (s.type === "Columns") {
      const cell = (f: CardItem, k: number, big: boolean) => (
        <div
          key={k}
          onClick={(e) => {
            e.stopPropagation();
            V.pickPart(s.id, "cards", k);
          }}
          style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left", cursor: "pointer", borderRadius: 8, padding: 6, margin: -6, boxShadow: partRing("cards", k) }}
        >
          {cardT(f, k, { fontSize: big ? 17 : 15, fontWeight: big ? 700 : 600, cursor: "text" })}
          {cardD(f, k, { fontSize: 12.5, color: c.muted, lineHeight: 1.65, cursor: "text" })}
        </div>
      );
      if (s.variant < 2)
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 24 }}>
            {visCards.map((f, k) => cell(f, k, false))}
          </div>
        );
      const img = (
        <div key="img" style={{ aspectRatio: "16/10" }}>
          <ImageSlot node={"img/" + s.id + "/col"} src={s.images?.col} placeholder="이미지를 드래그하세요" radius={10} dark={dk} onImage={(u) => setImage("col", u)} />
        </div>
      );
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 28, alignItems: "center" }}>
          {s.variant === 2 ? [...visCards.map((f, k) => cell(f, k, true)), img] : [img, ...visCards.map((f, k) => cell(f, k, true))]}
        </div>
      );
    }

    if (s.type === "Divider") {
      if (s.variant === 1) return <div style={{ height: 32 }} />;
      if (s.variant === 2)
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1, height: 1, background: c.line }} />
            <Editable
              k={s.id + "t" + E} node={"edit/" + s.id + "/title"}
              text={s.title ?? ""}
              onCommit={(v) => editSec({ title: v }, "텍스트 수정")}
              style={mono9({ fontSize: 10, color: c.muted, letterSpacing: ".14em", textTransform: "uppercase", cursor: "text", flex: "none" })}
            />
            <div style={{ flex: 1, height: 1, background: c.line }} />
          </div>
        );
      return <div style={{ height: 1, background: c.line }} />;
    }

    if (s.type === "Footer")
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, textAlign: "left" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: accent }} />
                <Editable
                  k={s.id + "t" + E} node={"edit/" + s.id + "/title"}
                  text={s.title ?? ""}
                  onCommit={(v) => editSec({ title: v }, "텍스트 수정")}
                  style={{ fontWeight: 700, fontSize: 13, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":title") }}
                />
              </div>
              <Editable
                k={s.id + "s" + E} node={"edit/" + s.id + "/sub"}
                text={s.sub ?? ""}
                onCommit={(v) => editSec({ sub: v }, "텍스트 수정")}
                style={{ fontSize: 11, color: c.muted, lineHeight: 1.5, cursor: "text", borderRadius: 3, boxShadow: elemRing(s.id + ":sub") }}
              />
            </div>
            {(s.cols ?? []).map((col: FootCol, ci: number) => (
              <div
                key={ci}
                onClick={(e) => {
                  e.stopPropagation();
                  V.pickPart(s.id, "cols", ci);
                }}
                style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5, color: c.muted, padding: "4px 6px", margin: "-4px -6px", borderRadius: 7, boxShadow: partRing("cols", ci), cursor: "pointer" }}
              >
                <Editable
                  k={s.id + "fch" + ci + "_" + E}
                  text={col.h}
                  onCommit={(v) => editPart("cols", ci, { h: v }, "컬럼 제목 수정")}
                  style={{ fontWeight: 600, color: c.fg, fontSize: 11, cursor: "text" }}
                />
                {(col.items ?? []).map((t, ii) => (
                  <Editable
                    key={s.id + "fci" + ci + "_" + ii + "_" + E}
                    k={s.id + "fci" + ci + "_" + ii + "_" + E}
                    text={t}
                    onClick={(e) => {
                      e.stopPropagation();
                      V.selectColLink(s.id, ci, ii);
                    }}
                    onCommit={(v) => {
                      const items = col.items.slice();
                      items[ii] = v;
                      editPart("cols", ci, { items }, "링크 수정");
                    }}
                    style={{ cursor: "text", borderRadius: 3, padding: "1px 4px", margin: "-1px -4px", boxShadow: elemRing(s.id + ":cols:" + ci + ":" + ii) }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${c.line}`, paddingTop: 12 }}>
            <Editable
              k={s.id + "cp" + E} node={"edit/" + s.id + "/copy"}
              text={s.copy ?? ""}
              onCommit={(v) => editSec({ copy: v }, "카피라이트 수정")}
              style={mono9({ display: "inline-block", fontSize: 10, color: c.muted, cursor: "text", borderRadius: 3, padding: "2px 4px", margin: "-2px -4px", boxShadow: elemRing(s.id + ":copy") })}
            />
          </div>
        </div>
      );

    return null;
  };

  return (
    <div>
      {/* 섹션 앞 드롭존 — 발행에는 없다 */}
      {exportMode ? null : (
      <div
        data-node={"dz/" + i}
        onDragOver={(e) => {
          if (!addDragging) return;
          e.preventDefault();
          if (V.dropIdx !== i) V.setDropIdx(i);
        }}
        onDrop={(e) => {
          const p = V.dragPayload;
          if (!p || p.kind !== "add") return;
          e.preventDefault();
          e.stopPropagation();
          store.sectionAdd(p.type, 0, fullIdx());
          V.setDrag(null);
          V.setDropIdx(null);
        }}
        style={{ height: dzActive ? 28 : addDragging ? 16 : 6, background: dzActive ? "rgba(42,111,219,.08)" : "transparent", transition: "height .12s ease", display: "grid", placeItems: "center", overflow: "hidden" }}
      >
        <div style={{ width: "60%", height: 3, borderRadius: 2, background: accent, opacity: dzActive ? 1 : 0, animation: dzActive ? "cs-dropPulse 1s infinite" : "none" }} />
      </div>
      )}

      <div
        data-node={exportMode ? undefined : "section/" + s.id}
        draggable={!exportMode}
        onClick={(e) => {
          e.stopPropagation();
          V.select(s.id);
        }}
        onDragStart={(e) => {
          e.stopPropagation();
          try {
            e.dataTransfer.setData("text/plain", s.id);
            e.dataTransfer.effectAllowed = "move";
          } catch {
            /* noop */
          }
          V.reorderStart(s.id);
        }}
        onDragOver={onOverSection}
        style={{ position: "relative", cursor: "pointer", opacity: V.dragPayload?.kind === "move" && V.dragPayload.id === s.id ? 0.4 : 1, transition: "opacity .15s ease" }}
      >
        {selected ? (
          <>
            <div style={{ position: "absolute", inset: -1, border: `1px solid ${accent}`, pointerEvents: "none", zIndex: 9 }} />
            {(["top", "bottom"] as const).map((vpos) =>
              (["left", "right"] as const).map((hpos) => (
                <div
                  key={vpos + hpos}
                  style={{ position: "absolute", [vpos]: -4, [hpos]: -4, width: 7, height: 7, background: "#fff", border: `1px solid ${accent}`, borderRadius: 1.5, pointerEvents: "none", zIndex: 10 }}
                />
              )),
            )}
            <div
              style={{ position: "absolute", top: -24, left: -1, zIndex: 11, height: 22, display: "flex", alignItems: "center", fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500, color: "#fff", background: accent, padding: "0 10px", borderRadius: 6, pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 2px 6px rgba(20,30,45,.18)" }}
            >
              {s.type} · {vname}
            </div>
            <div style={{ position: "absolute", top: -24, right: -1, zIndex: 12, height: 22, display: "flex", alignItems: "center", gap: 1, background: accent, borderRadius: 6, padding: "0 3px", boxShadow: "0 2px 6px rgba(20,30,45,.18)" }}>
              <button
                className="hov-white22"
                title="변형 교체"
                onClick={(e) => {
                  e.stopPropagation();
                  store.sectionSwap(s.id);
                }}
                style={{ height: 20, padding: "0 8px", border: "none", borderRadius: 4, background: "transparent", color: "#fff", cursor: "pointer", fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 500 }}
              >
                ↻ 교체
              </button>
              <button
                className="hov-white22"
                title="위로"
                onClick={(e) => {
                  e.stopPropagation();
                  const ri = fullIdx();
                  if (ri > 0) store.sectionMove(s.id, ri - 1);
                }}
                style={{ width: 22, height: 20, border: "none", borderRadius: 4, background: "transparent", color: "#fff", cursor: "pointer", fontSize: 10 }}
              >
                ↑
              </button>
              <button
                className="hov-white22"
                title="아래로"
                onClick={(e) => {
                  e.stopPropagation();
                  const ri = fullIdx();
                  if (ri < S.stack.length - 1) store.sectionMove(s.id, ri + 2);
                }}
                style={{ width: 22, height: 20, border: "none", borderRadius: 4, background: "transparent", color: "#fff", cursor: "pointer", fontSize: 10 }}
              >
                ↓
              </button>
              <button
                className="hov-white22"
                title="삭제"
                onClick={(e) => {
                  e.stopPropagation();
                  store.sectionRemove(s.id);
                  V.select(null);
                }}
                style={{ width: 22, height: 20, border: "none", borderRadius: 4, background: "transparent", color: "#ffd3d3", cursor: "pointer", fontSize: 10 }}
              >
                ✕
              </button>
            </div>
            <button
              title="위에 섹션 추가"
              onClick={(e) => {
                e.stopPropagation();
                const ri = fullIdx();
                V.setAddAt(V.addAt === ri ? null : ri);
                V.setAddPickerOpen(false);
              }}
              style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", zIndex: 26, width: 26, height: 26, borderRadius: "50%", border: "none", background: accent, color: "#fff", fontSize: 14, lineHeight: 1, cursor: "pointer", boxShadow: "0 3px 10px rgba(20,30,45,.28)", display: "grid", placeItems: "center" }}
            >
              ＋
            </button>
            <button
              title="아래에 섹션 추가"
              onClick={(e) => {
                e.stopPropagation();
                const ri = fullIdx();
                V.setAddAt(V.addAt === ri + 1 ? null : ri + 1);
                V.setAddPickerOpen(false);
              }}
              style={{ position: "absolute", bottom: -13, left: "50%", transform: "translateX(-50%)", zIndex: 26, width: 26, height: 26, borderRadius: "50%", border: "none", background: accent, color: "#fff", fontSize: 14, lineHeight: 1, cursor: "pointer", boxShadow: "0 3px 10px rgba(20,30,45,.28)", display: "grid", placeItems: "center" }}
            >
              ＋
            </button>
            {pickerOpen ? (
              <div
                onClick={stop}
                style={{
                  position: "absolute",
                  top: V.addAt === fullIdx() ? 18 : "calc(100% + 18px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 60,
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 6,
                  width: "min(500px,92%)",
                  maxHeight: 264,
                  overflowY: "auto",
                  padding: 10,
                  background: "#fff",
                  border: "1px solid #dde3ea",
                  borderRadius: 12,
                  boxShadow: "0 14px 40px rgba(20,30,45,.2)",
                  cursor: "default",
                }}
              >
                {SECTION_TYPES.map((t) => (
                  <button
                    key={t}
                    className="hov-accent"
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation();
                      const at = V.addAt;
                      V.setAddPickerOpen(false);
                      V.setAddAt(null);
                      store.sectionAdd(t, 0, at == null || at === "end" ? null : at);
                    }}
                    style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, padding: "9px 10px", border: "1px solid #e4e9ef", borderRadius: 9, background: "#fff", cursor: "pointer", fontFamily: FONT_SANS, textAlign: "left" }}
                  >
                    <span style={mono9({ fontSize: 8.5, color: "#a8b1bd", letterSpacing: ".05em" })}>{CATALOG[t].glyph}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "#1b2430" }}>{CATALOG[t].ko}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        <div style={{ background: effBg, color: c.fg, padding: pad, wordBreak: "keep-all", overflowWrap: "break-word", textWrap: "pretty", overflowX: "clip" } as CSSProperties}>
          {content()}
        </div>
      </div>
    </div>
  );
}
