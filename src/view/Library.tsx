// 좌측 라이브러리 — Files(페이지)/Assets(컴포넌트·템플릿) 탭, 검색, 접기 레일, 오버레이 플라이아웃.
import type { StudioStore, StudioState } from "@/store";
import { CATALOG, SECTION_TYPES, TEMPLATES } from "@/core/model";
import { FONT_MONO, FONT_SANS } from "@/styles";
import type { ViewApi } from "@/view/common";

export interface LibraryUi {
  panelL: boolean;
  setPanelL(v: boolean): void;
  libFlyout: boolean;
  setLibFlyout(v: boolean): void;
  tab: "files" | "assets";
  setTab(v: "files" | "assets"): void;
  openGroup: "components" | "templates";
  setOpenGroup(v: "components" | "templates"): void;
  search: string;
  setSearch(v: string): void;
}

export function LibraryRail({ L }: { L: LibraryUi }) {
  return (
    <div style={{ width: 44, flex: "none", background: "#ffffff", borderRight: "1px solid #dde3ea", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 0" }}>
      <button
        className="hov-bg"
        title="라이브러리 펼치기"
        onClick={() => {
          L.setPanelL(true);
          L.setLibFlyout(false);
        }}
        style={{ width: 30, height: 30, border: "1px solid #dde3ea", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 12, color: "#4a5568" }}
      >
        ⟩
      </button>
      <button
        className="hov-bg"
        title="Files"
        onClick={() => {
          L.setLibFlyout(true);
          L.setTab("files");
        }}
        style={{ width: 30, height: 30, border: "none", borderRadius: 8, background: "transparent", cursor: "pointer", fontSize: 14 }}
      >
        📄
      </button>
      <button
        className="hov-bg"
        title="Assets"
        onClick={() => {
          L.setLibFlyout(true);
          L.setTab("assets");
        }}
        style={{ width: 30, height: 30, border: "none", borderRadius: 8, background: "transparent", cursor: "pointer", fontSize: 14 }}
      >
        🧩
      </button>
    </div>
  );
}

export function LibraryPanel({ S, store, V, L }: { S: StudioState; store: StudioStore; V: ViewApi; L: LibraryUi }) {
  const accent = S.accent;
  const q = L.search.trim().toLowerCase();
  const isOverlay = !L.panelL && L.libFlyout;

  const tabBtn = (label: string, id: "files" | "assets") => (
    <button
      onClick={() => L.setTab(id)}
      data-node={"tab/" + id}
      style={{ flex: 1, height: 30, border: "none", borderRadius: 7, cursor: "pointer", fontFamily: FONT_SANS, fontSize: 12, fontWeight: 600, background: L.tab === id ? "#eef1f4" : "transparent", color: L.tab === id ? "#1b2430" : "#8a94a3" }}
    >
      {label}
    </button>
  );

  const groupHeader = (label: string, hint: string, group: "components" | "templates") => (
    <button
      onClick={() => L.setOpenGroup(group)}
      style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", cursor: "pointer", padding: group === "templates" ? "8px 2px 4px" : "4px 2px", fontFamily: FONT_SANS, fontSize: 10.5, fontWeight: 600, color: "#8a94a3", textTransform: "uppercase", letterSpacing: ".06em", textAlign: "left" }}
    >
      <span style={{ fontSize: 7 }}>{L.openGroup === group ? "▼" : "▶"}</span>
      {label}
      <span style={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 400, textTransform: "none" }}>{hint}</span>
    </button>
  );

  const libItems = SECTION_TYPES.filter((t) => !q || t.toLowerCase().includes(q) || CATALOG[t].ko.includes(q));
  const tplItems = TEMPLATES.filter((t) => !q || t.name.toLowerCase().includes(q));
  const pages = store.pageList().filter((p) => !q || p.name.toLowerCase().includes(q));

  return (
    <div
      style={{
        width: 272,
        flex: "none",
        background: "#ffffff",
        borderRight: "1px solid #dde3ea",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        position: isOverlay ? "absolute" : "relative",
        left: isOverlay ? 44 : 0,
        top: 0,
        bottom: 0,
        zIndex: isOverlay ? 45 : 1,
        boxShadow: isOverlay ? "14px 0 36px rgba(20,30,45,.2)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: "10px 12px 0", gap: 2, flex: "none" }}>
        {tabBtn("Files", "files")}
        {tabBtn("Assets", "assets")}
        {L.panelL ? (
          <button
            className="hov-bg"
            title="사이드바 접기"
            onClick={() => {
              L.setPanelL(false);
              L.setLibFlyout(false);
            }}
            style={{ width: 26, height: 30, flex: "none", border: "none", borderRadius: 7, background: "transparent", cursor: "pointer", fontSize: 12, color: "#8a94a3" }}
          >
            ⟨
          </button>
        ) : null}
        {isOverlay ? (
          <>
            <button
              className="hov-bg"
              title="사이드바로 고정"
              onClick={() => {
                L.setPanelL(true);
                L.setLibFlyout(false);
              }}
              style={{ width: 26, height: 30, flex: "none", border: "none", borderRadius: 7, background: "transparent", cursor: "pointer", fontSize: 11 }}
            >
              📌
            </button>
            <button
              className="hov-bg"
              title="닫기"
              onClick={() => L.setLibFlyout(false)}
              style={{ width: 26, height: 30, flex: "none", border: "none", borderRadius: 7, background: "transparent", cursor: "pointer", fontSize: 11, color: "#8a94a3" }}
            >
              ✕
            </button>
          </>
        ) : null}
      </div>
      <div style={{ padding: "10px 12px", flex: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, height: 32, padding: "0 10px", background: "#f2f5f8", border: "1px solid #dde3ea", borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: "#8a94a3" }}>⌕</span>
          <input
            value={L.search}
            onChange={(e) => L.setSearch(e.target.value)}
            placeholder={L.tab === "assets" ? "컴포넌트 · 템플릿 검색…" : "페이지 검색…"}
            style={{ flex: 1, border: "none", background: "transparent", fontFamily: FONT_SANS, fontSize: 12, color: "#1b2430", minWidth: 0 }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        {L.tab === "files" ? (
          <>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8a94a3", textTransform: "uppercase", letterSpacing: ".06em", padding: "2px 2px 4px" }}>Pages</div>
            {pages.map((pg) => (
              <button
                key={pg.id}
                className="hov-line"
                data-node={"page/" + pg.id}
                onClick={() => store.pageOpen(pg.id)}
                style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 10px", border: `1px solid ${pg.active ? accent : "#e4e9ef"}`, borderRadius: 9, background: pg.active ? "#eef2ff" : "#fff", cursor: "pointer", textAlign: "left", fontFamily: FONT_SANS }}
              >
                <span style={{ width: 26, height: 22, flex: "none", borderRadius: 4, background: "#eef1f4", display: "grid", placeItems: "center", fontFamily: FONT_MONO, fontSize: 8.5, color: "#6b7686" }}>PG</span>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1b2430", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pg.name}</span>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: "#8a94a3" }}>{pg.count} sections</span>
                </span>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: pg.active ? accent : "#dfe5ec", flex: "none" }} />
              </button>
            ))}
            <button
              className="hov-dash"
              onClick={() => store.pageAdd()}
              style={{ height: 32, border: "1.5px dashed #c7cfd8", borderRadius: 9, background: "transparent", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 11.5, color: "#6b7686", fontWeight: 600 }}
            >
              ＋ 새 페이지
            </button>
          </>
        ) : (
          <>
            {groupHeader("Components", "클릭·드래그로 배치", "components")}
            {L.openGroup === "components"
              ? libItems.map((t) => (
                  <div
                    key={t}
                    className="hov-lib"
                    data-node={"lib/" + t}
                    draggable
                    onDragStart={() => V.setDrag({ kind: "add", type: t })}
                    onClick={() => store.sectionAdd(t, 0, null)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", border: "1px solid #e4e9ef", borderRadius: 9, background: "#fff", cursor: "grab" }}
                  >
                    <div style={{ width: 34, height: 26, flex: "none", borderRadius: 5, background: "#eef1f4", display: "grid", placeItems: "center", fontFamily: FONT_MONO, fontSize: 9, color: "#6b7686", letterSpacing: ".02em" }}>
                      {CATALOG[t].glyph}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t}</span>
                      <span style={{ fontSize: 10.5, color: "#8a94a3" }}>
                        {CATALOG[t].ko} · 변형 {CATALOG[t].variants.length}
                      </span>
                    </div>
                    <span style={{ fontSize: 14, color: "#c1cad4", fontWeight: 600 }}>+</span>
                  </div>
                ))
              : null}
            {groupHeader("Templates", "선택 후 부분 교체", "templates")}
            {L.openGroup === "templates"
              ? tplItems.map((t) => (
                  <div
                    key={t.name}
                    className="hov-tpl"
                    data-node={"tpl/" + t.name}
                    onClick={() => {
                      store.templateApply(t.name);
                      V.select(null);
                    }}
                    style={{ border: "1px solid #e4e9ef", borderRadius: 10, background: "#fff", cursor: "pointer", overflow: "hidden" }}
                  >
                    <div
                      style={{ height: 56, background: "repeating-linear-gradient(45deg,#eef1f4,#eef1f4 8px,#f5f7fa 8px,#f5f7fa 16px)", borderBottom: "1px solid #edf1f5", display: "grid", placeItems: "center", fontFamily: FONT_MONO, fontSize: 9, color: "#8a94a3", letterSpacing: ".06em" }}
                    >
                      {t.recipe}
                    </div>
                    <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</span>
                        <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: "#8a94a3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.spec.length} sections</span>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: accent, flex: "none" }}>적용 →</span>
                    </div>
                  </div>
                ))
              : null}
          </>
        )}
      </div>
    </div>
  );
}
