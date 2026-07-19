// 상단 바 — 로고·페이지명, AI 지시 입력, Desktop/Mobile 토글, 페이지 다크, undo/redo,
// 버전 히스토리 드롭다운, Publish(시각 전용).
import { useState } from "react";
import type { StudioFacade, StudioState } from "@/store";
import { FONT_MONO, FONT_SANS } from "@/styles";
import type { ViewApi } from "@/view/common";

export function TopBar({ S, store, V, onPublish }: { S: StudioState; store: StudioFacade; V: ViewApi; onPublish?: () => void }) {
  const [aiValue, setAiValue] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const accent = S.accent;
  const isMobile = S.device === "mobile";
  const canUndo = S.historyIdx > 0;
  const canRedo = S.historyIdx < S.history.length - 1;
  const pageName = S.pages.find((p) => p.id === S.curPage)?.name ?? "untitled-page";

  const runAi = () => {
    const q = aiValue.trim();
    if (!q) return;
    store.runAi(q, V.selectedId);
    setAiValue("");
  };

  const segBtn = (label: string, active: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        height: 26,
        padding: "0 12px",
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        fontFamily: FONT_SANS,
        fontSize: 11.5,
        fontWeight: 600,
        background: active ? "#ffffff" : "transparent",
        color: active ? "#1b2430" : "#8a94a3",
        boxShadow: active ? "0 1px 3px rgba(20,30,45,.12)" : "none",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, height: 52, padding: "0 16px", background: "#ffffff", borderBottom: "1px solid #dde3ea", flex: "none", position: "relative", zIndex: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: accent, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>D</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>Design Studio</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: "#8a94a3" }}>{pageName}</span>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "min(560px,100%)", height: 34, padding: "0 6px 0 12px", background: "#f2f5f8", border: "1px solid #dde3ea", borderRadius: 9 }}>
          <span style={{ fontSize: 13 }}>✦</span>
          <input
            value={aiValue}
            onChange={(e) => setAiValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runAi();
            }}
            placeholder="AI에게 지시하세요 — 예: 히어로 추가, 가격표 삭제, 배경 어둡게, 템플릿 SaaS 적용"
            style={{ flex: 1, border: "none", background: "transparent", fontFamily: FONT_SANS, fontSize: 12.5, color: "#1b2430", minWidth: 0 }}
          />
          <button
            onClick={runAi}
            style={{ height: 24, padding: "0 12px", border: "none", borderRadius: 6, background: accent, color: "#fff", fontFamily: FONT_SANS, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
          >
            실행
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
        <div style={{ display: "flex", background: "#f2f5f8", border: "1px solid #dde3ea", borderRadius: 8, padding: 2, gap: 2 }}>
          {segBtn("Desktop", !isMobile, () => {
            store.setDevice("desktop");
            V.setMobNav(false);
            V.setMobToc(false);
          })}
          {segBtn("Mobile", isMobile, () => store.setDevice("mobile"))}
        </div>
        <button
          className="hov-line"
          title="페이지 다크 모드"
          onClick={() => store.setDark(!S.pageDark)}
          style={{ width: 30, height: 30, border: `1px solid ${S.pageDark ? "#1b2430" : "#dde3ea"}`, borderRadius: 8, background: S.pageDark ? "#1b2430" : "#fff", cursor: "pointer", fontSize: 13, display: "grid", placeItems: "center" }}
        >
          {S.pageDark ? "☀️" : "🌙"}
        </button>
        <div style={{ display: "flex", gap: 2 }}>
          <button
            className="hov-bg"
            title="실행취소"
            onClick={() => store.undo()}
            style={{ width: 30, height: 30, border: "1px solid #dde3ea", borderRadius: "8px 3px 3px 8px", background: "#fff", cursor: "pointer", fontSize: 14, color: "#4a5568", opacity: canUndo ? 1 : 0.35 }}
          >
            ↶
          </button>
          <button
            className="hov-bg"
            title="다시실행"
            onClick={() => store.redo()}
            style={{ width: 30, height: 30, border: "1px solid #dde3ea", borderRadius: "3px 8px 8px 3px", background: "#fff", cursor: "pointer", fontSize: 14, color: "#4a5568", opacity: canRedo ? 1 : 0.35 }}
          >
            ↷
          </button>
        </div>
        <button
          className="hov-bg"
          onClick={() => setHistoryOpen(!historyOpen)}
          style={{ height: 30, padding: "0 12px", border: "1px solid #dde3ea", borderRadius: 8, background: "#fff", cursor: "pointer", fontFamily: FONT_MONO, fontSize: 11, color: "#4a5568" }}
        >
          v{S.historyIdx + 1}
        </button>
        <button
          data-node="publish"
          onClick={onPublish}
          style={{ height: 30, padding: "0 16px", border: "none", borderRadius: 8, background: "#1b2430", color: "#fff", cursor: "pointer", fontFamily: FONT_SANS, fontSize: 12, fontWeight: 600 }}
        >
          Publish
        </button>
      </div>

      {historyOpen ? (
        <div style={{ position: "absolute", top: 56, right: 112, width: 240, background: "#fff", border: "1px solid #dde3ea", borderRadius: 10, boxShadow: "0 12px 32px rgba(20,30,45,.14)", padding: 6, zIndex: 50 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8a94a3", textTransform: "uppercase", letterSpacing: ".06em", padding: "6px 8px 4px" }}>버전 히스토리</div>
          {S.history
            .map((h, i) => ({ h, i }))
            .reverse()
            .map(({ h, i }) => (
              <button
                key={i}
                className="hov-bg"
                onClick={() => {
                  store.historyRestore(i + 1);
                  setHistoryOpen(false);
                  V.select(null);
                }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px", border: "none", borderRadius: 7, background: i === S.historyIdx ? "#eef2ff" : "transparent", cursor: "pointer", textAlign: "left", fontFamily: FONT_SANS }}
              >
                <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: i === S.historyIdx ? accent : "#a8b1bd", fontWeight: 500 }}>v{i + 1}</span>
                <span style={{ fontSize: 12, color: "#1b2430", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.label}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: "#a8b1bd" }}>{h.count}개</span>
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}
