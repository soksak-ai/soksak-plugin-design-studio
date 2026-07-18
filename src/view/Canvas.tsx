// 중앙 캔버스 — 미리보기 프레임(페이지 레이아웃 사이드바·모바일 드로어 포함), 섹션 스택,
// 빈 상태, 끝 드롭존. 프레임 폭은 기기 토글(390/960)로 애니메이션한다.
import type { CSSProperties } from "react";
import type { StudioStore, StudioState } from "@/store";
import { FONT_MONO } from "@/styles";
import { Editable, stop, type ViewApi } from "@/view/common";
import { SectionView } from "@/view/SectionView";

const LOGO_PRESETS = [
  { name: "스퀘어", rad: "5px", tf: "none", bg: (a: string) => a },
  { name: "서클", rad: "50%", tf: "none", bg: () => "#1f8a5b" },
  { name: "다이아", rad: "3px", tf: "rotate(45deg) scale(.82)", bg: () => "#d97757" },
  { name: "도넛", rad: "50%", tf: "none", bg: () => "radial-gradient(closest-side, transparent 42%, #7b5bd6 46%)" },
];
export { LOGO_PRESETS };

export function Canvas({ S, store, V }: { S: StudioState; store: StudioStore; V: ViewApi }) {
  const isMobile = S.device === "mobile";
  const accent = S.accent;
  const E = S.epoch;
  const visibleStack = S.stack.filter((s) => !((s.vis === "desktop" && isMobile) || (s.vis === "mobile" && !isMobile)));
  const sideL = (S.layout === "left" || S.layout === "both") && !isMobile;
  const sideR = (S.layout === "right" || S.layout === "both") && !isMobile;
  const sideMob = S.layout !== "stack" && isMobile;
  const showMobLeft = (S.layout === "left" || S.layout === "both") && isMobile;
  const showMobRight = (S.layout === "right" || S.layout === "both") && isMobile;

  const canvasBg = S.pageDark ? "#0b1120" : "#fff";
  const canvasLine = S.pageDark ? "#26334d" : "#d8dfe7";
  const shellBg = S.pageDark ? "#0d1526" : "#fbfcfd";
  const shellLine = S.pageDark ? "#22304a" : "#e8edf2";
  const shellMut = S.pageDark ? "#7c8ba6" : "#6b7686";
  const shellFg = S.pageDark ? "#e6ecf5" : "#1b2430";
  const shellBtnBg = S.pageDark ? "#16203a" : "#fff";

  const logo = LOGO_PRESETS[S.logoIcon] ?? LOGO_PRESETS[0];
  const logoShowIcon = S.logoMode !== "text";
  const logoShowText = S.logoMode !== "icon";

  const sidePos: CSSProperties["position"] = S.sideFixed ? "sticky" : "static";
  const sideMaxH = S.sideFixed ? "calc(100vh - 200px)" : "none";

  const tocItems = S.stack.filter((x) => x.title).slice(0, 8);
  const endActive = V.dragPayload != null && V.dropIdx === S.stack.length;
  const addDragging = V.dragPayload?.kind === "add";

  const brandLogo = (size: number, radOverride?: string) =>
    logoShowIcon ? (
      <div style={{ width: size, height: size, flex: "none", borderRadius: radOverride ?? logo.rad, background: logo.bg(accent), transform: logo.tf }} />
    ) : null;

  const navItems = (interactive: boolean) =>
    S.sideNav.map((t, k) => {
      const bg = k === 0 ? (S.pageDark ? "rgba(255,255,255,.08)" : "#eef2ff") : "transparent";
      const color = k === 0 ? (S.pageDark ? "#9db8e8" : accent) : S.pageDark ? "#aeb9cc" : "#4a5568";
      return interactive ? (
        <Editable
          key={"sn" + k + "_" + E}
          k={"sn" + k + "_" + E}
          text={t}
          onCommit={(v) => {
            const sn = S.sideNav.map((x, i) => (i === k ? v : x));
            store.setShell({ sideNav: sn });
          }}
          style={{ display: "block", padding: "7px 10px", borderRadius: 7, background: bg, color, fontSize: 12, fontWeight: 500, cursor: "text" }}
        />
      ) : (
        <span key={k} onClick={() => V.setMobNav(false)} style={{ display: "block", padding: "9px 10px", borderRadius: 7, background: bg, color, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          {t}
        </span>
      );
    });

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, height: 36, padding: "0 16px", flex: "none", color: "#8a94a3", fontFamily: FONT_MONO, fontSize: 10.5 }}>
        <span>{isMobile ? "Mobile · 390px" : "Desktop · 960px"}</span>
        <span>·</span>
        <span>{visibleStack.length} sections</span>
        <span style={{ flex: 1 }} />
        <span>{S.statusMsg}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "0 24px" }} onClick={() => V.deselect()}>
        <div
          style={{
            width: isMobile ? 390 : 960,
            maxWidth: "100%",
            margin: "30px auto 60px",
            background: canvasBg,
            border: `1px solid ${canvasLine}`,
            borderRadius: 12,
            boxShadow: "0 8px 28px rgba(20,30,45,.09)",
            transition: "width .25s ease",
            display: "flex",
            alignItems: "stretch",
          }}
        >
          {sideL ? (
            <div style={{ width: 190, flex: "none", borderRight: `1px solid ${shellLine}`, background: shellBg, borderRadius: "12px 0 0 12px" }}>
              <div style={{ position: sidePos, top: 0, padding: "18px 12px", display: "flex", flexDirection: "column", gap: 4, maxHeight: sideMaxH, overflowY: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 12px" }}>
                  {brandLogo(18)}
                  {logoShowText ? (
                    <Editable
                      k={"brand_" + E}
                      text={S.shellBrand}
                      onCommit={(v) => {
                        const t = v.trim();
                        if (t) store.setShell({ shellBrand: t });
                      }}
                      style={{ fontWeight: 700, fontSize: 13, color: shellFg, cursor: "text", borderRadius: 3 }}
                    />
                  ) : null}
                </div>
                {navItems(true)}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 8px 0", borderTop: `1px solid ${shellLine}`, marginTop: 14 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#d3dbe4" }} />
                  <span style={{ fontSize: 11, color: shellMut }}>사용자</span>
                </div>
              </div>
            </div>
          ) : null}

          <div
            style={{ flex: 1, minWidth: 0, position: "relative" }}
            onDragOver={(e) => {
              if (V.dragPayload?.kind === "move") {
                e.preventDefault();
                try {
                  e.dataTransfer.dropEffect = "move";
                } catch {
                  /* noop */
                }
              }
            }}
            onDrop={(e) => {
              if (V.dragPayload?.kind === "move") e.preventDefault();
            }}
          >
            {sideMob ? (
              <div
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${shellLine}`, background: shellBg, borderRadius: "12px 12px 0 0", position: S.mobBarFixed ? "sticky" : "static", top: 0, zIndex: 15 }}
              >
                {showMobLeft ? (
                  <button
                    title="메뉴"
                    onClick={(e) => {
                      e.stopPropagation();
                      V.setMobNav(!V.mobNavOpen);
                    }}
                    style={{ width: 32, height: 30, border: `1px solid ${shellLine}`, borderRadius: 7, background: shellBtnBg, cursor: "pointer", fontSize: 13, color: shellFg, display: "grid", placeItems: "center" }}
                  >
                    ☰
                  </button>
                ) : null}
                <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1 }}>
                  {brandLogo(16, logo.rad === "5px" ? "4px" : logo.rad)}
                  {logoShowText ? (
                    <Editable
                      k={"brandm_" + E}
                      text={S.shellBrand}
                      onCommit={(v) => {
                        const t = v.trim();
                        if (t) store.setShell({ shellBrand: t });
                      }}
                      style={{ fontWeight: 700, fontSize: 13, color: shellFg, cursor: "text", borderRadius: 3 }}
                    />
                  ) : null}
                </div>
                {showMobRight ? (
                  <button
                    title="페이지 내 이동"
                    onClick={(e) => {
                      e.stopPropagation();
                      V.setMobToc(!V.mobTocOpen);
                    }}
                    style={{ width: 32, height: 30, border: `1px solid ${shellLine}`, borderRadius: 7, background: shellBtnBg, cursor: "pointer", fontSize: 13, color: shellFg, display: "grid", placeItems: "center" }}
                  >
                    ≣
                  </button>
                ) : null}
              </div>
            ) : null}

            {V.mobNavOpen && isMobile ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  V.setMobNav(false);
                }}
                style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(15,23,42,.42)", borderRadius: "12px 12px 0 0" }}
              >
                <div
                  onClick={stop}
                  style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 230, background: shellBg, borderRight: `1px solid ${shellLine}`, borderRadius: "12px 0 0 0", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4, boxShadow: "8px 0 28px rgba(15,23,42,.25)", animation: "cs-drawerL .2s ease" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 12px" }}>
                    {brandLogo(18)}
                    {logoShowText ? <span style={{ fontWeight: 700, fontSize: 13, color: shellFg }}>{S.shellBrand}</span> : null}
                    <span style={{ flex: 1 }} />
                    <button onClick={() => V.setMobNav(false)} style={{ border: "none", background: "transparent", color: shellMut, cursor: "pointer", fontSize: 13 }}>
                      ✕
                    </button>
                  </div>
                  {navItems(false)}
                </div>
              </div>
            ) : null}

            {V.mobTocOpen && isMobile ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  V.setMobToc(false);
                }}
                style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(15,23,42,.42)", borderRadius: "12px 12px 0 0" }}
              >
                <div
                  onClick={stop}
                  style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 230, background: shellBg, borderLeft: `1px solid ${shellLine}`, borderRadius: "0 12px 0 0", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 8, boxShadow: "-8px 0 28px rgba(15,23,42,.25)", animation: "cs-drawerR .2s ease" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#8a94a3", letterSpacing: ".1em", textTransform: "uppercase", flex: 1 }}>On this page</span>
                    <button onClick={() => V.setMobToc(false)} style={{ border: "none", background: "transparent", color: shellMut, cursor: "pointer", fontSize: 13 }}>
                      ✕
                    </button>
                  </div>
                  {tocItems.map((x) => (
                    <span
                      key={x.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        V.select(x.id);
                        V.setMobToc(false);
                        V.setMobNav(false);
                        V.scrollToSection(x.id);
                      }}
                      style={{ fontSize: 13, color: shellMut, cursor: "pointer", padding: "6px 0", borderLeft: `2px solid ${shellLine}`, paddingLeft: 10 }}
                    >
                      {x.title}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {S.stack.length === 0 ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const p = V.dragPayload;
                  if (p && p.kind === "add") {
                    store.sectionAdd(p.type, 0, 0);
                    V.setDrag(null);
                    V.setDropIdx(null);
                  }
                }}
                style={{ padding: "80px 40px", textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 12, border: "1.5px dashed #b9c6d6", display: "grid", placeItems: "center", fontSize: 20, color: "#8a94a3" }}>+</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#4a5568" }}>빈 페이지입니다</div>
                <div style={{ fontSize: 12, color: "#8a94a3", maxWidth: 320, lineHeight: 1.5 }}>
                  왼쪽에서 컴포넌트를 드래그하거나 클릭해 쌓으세요. 템플릿을 선택해 시작할 수도 있습니다.
                </div>
              </div>
            ) : null}

            {visibleStack.map((s, i) => (
              <SectionView key={s.id} s={s} i={i} S={S} store={store} V={V} />
            ))}

            {S.stack.length > 0 ? (
              <div
                onDragOver={(e) => {
                  if (!addDragging) return;
                  e.preventDefault();
                  if (V.dropIdx !== S.stack.length) V.setDropIdx(S.stack.length);
                }}
                onDrop={(e) => {
                  const p = V.dragPayload;
                  if (!p || p.kind !== "add") return;
                  e.preventDefault();
                  store.sectionAdd(p.type, 0, S.stack.length);
                  V.setDrag(null);
                  V.setDropIdx(null);
                }}
                style={{ height: endActive ? 28 : addDragging ? 16 : 10, background: endActive ? "rgba(42,111,219,.08)" : "transparent", transition: "height .12s ease", display: "grid", placeItems: "center" }}
              >
                <div style={{ width: "60%", height: 3, borderRadius: 2, background: accent, opacity: endActive ? 1 : 0, animation: endActive ? "cs-dropPulse 1s infinite" : "none" }} />
              </div>
            ) : null}
          </div>

          {sideR ? (
            <div style={{ width: 170, flex: "none", borderLeft: `1px solid ${shellLine}`, background: shellBg, borderRadius: "0 12px 12px 0" }}>
              <div style={{ position: sidePos, top: 0, padding: "18px 14px", display: "flex", flexDirection: "column", gap: 7, maxHeight: sideMaxH, overflowY: "auto" }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#8a94a3", letterSpacing: ".1em", textTransform: "uppercase" }}>On this page</span>
                {tocItems.map((x) => (
                  <span
                    key={x.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      V.select(x.id);
                      V.scrollToSection(x.id);
                    }}
                    style={{ fontSize: 11.5, color: shellMut, cursor: "pointer", padding: "3px 0", borderLeft: `2px solid ${shellLine}`, paddingLeft: 9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {x.title}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
