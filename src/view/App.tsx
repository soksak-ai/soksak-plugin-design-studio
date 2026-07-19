// 앱 조립 — 상단 바 / 좌측 라이브러리 / 캔버스 / 우측 인스펙터+트리.
// 뷰-로컬 상태(선택·패널·드래그)는 여기서 소유하고 ViewApi 로 하위에 내린다.
import { useEffect, useMemo, useRef, useState } from "react";
import type { PartListKey } from "@/types";
import type { StudioFacade } from "@/store";
import { moveTo } from "@/core/model";
import { useStudio } from "@/view/useStore";
import type { DragPayload, SelPart, ViewApi } from "@/view/common";
import { TopBar } from "@/view/TopBar";
import { LibraryPanel, LibraryRail, type LibraryUi } from "@/view/Library";
import { Canvas } from "@/view/Canvas";
import { InspectorBody, InspectorRail } from "@/view/Inspector";
import { TreePanel } from "@/view/TreePanel";

/** 재시작 복원(B3)으로 오가는 뷰-로컬 상태 스냅샷 — JSON 직렬화 가능 값만. */
interface ViewRestoreState {
  v: 1;
  selectedId: string | null;
  selPart: SelPart | null;
  selElemKey: string | null;
  panelL: boolean;
  panelR: boolean;
  tab: "files" | "assets";
  openGroup: "components" | "templates";
  search: string;
  treeCollapsed: Record<string, boolean>;
}

function parseRestore(raw: unknown): Partial<ViewRestoreState> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<ViewRestoreState> = {};
  if (typeof r.selectedId === "string") out.selectedId = r.selectedId;
  const sp = r.selPart as { listKey?: unknown; idx?: unknown } | null | undefined;
  if (sp && typeof sp === "object" && typeof sp.listKey === "string" && typeof sp.idx === "number")
    out.selPart = sp as SelPart;
  if (typeof r.selElemKey === "string") out.selElemKey = r.selElemKey;
  if (typeof r.panelL === "boolean") out.panelL = r.panelL;
  if (typeof r.panelR === "boolean") out.panelR = r.panelR;
  if (r.tab === "files" || r.tab === "assets") out.tab = r.tab;
  if (r.openGroup === "components" || r.openGroup === "templates") out.openGroup = r.openGroup;
  if (typeof r.search === "string") out.search = r.search;
  if (r.treeCollapsed && typeof r.treeCollapsed === "object")
    out.treeCollapsed = r.treeCollapsed as Record<string, boolean>;
  return out;
}

export default function App({
  store,
  restore,
  onViewState,
  onPublish,
}: {
  store: StudioFacade;
  restore?: unknown;
  onViewState?: (state: unknown) => void;
  onPublish?: () => void;
}) {
  const S = useStudio(store);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [R] = useState(() => parseRestore(restore));

  const [selectedId, setSelectedId] = useState<string | null>(R.selectedId ?? null);
  const [selPart, setSelPart] = useState<SelPart | null>(R.selPart ?? null);
  const [selElemKey, setSelElemKey] = useState<string | null>(R.selElemKey ?? null);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [addAt, setAddAt] = useState<number | "end" | null>(null);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [mobNavOpen, setMobNavOpen] = useState(false);
  const [mobTocOpen, setMobTocOpen] = useState(false);
  const [treeCollapsed, setTreeCollapsed] = useState<Record<string, boolean>>(R.treeCollapsed ?? {});

  const [panelL, setPanelL] = useState(R.panelL ?? true);
  const [libFlyout, setLibFlyout] = useState(false);
  const [panelR, setPanelR] = useState(R.panelR ?? true);
  const [tab, setTab] = useState<"files" | "assets">(R.tab ?? "assets");
  const [openGroup, setOpenGroup] = useState<"components" | "templates">(R.openGroup ?? "components");
  const [search, setSearch] = useState(R.search ?? "");

  // 뷰-로컬 상태 보고(B3) — 변경마다 관찰 스냅샷을 뷰 레코드에 싣는다(재시작 복원 seam).
  useEffect(() => {
    if (!onViewState) return;
    const state: ViewRestoreState = {
      v: 1,
      selectedId,
      selPart,
      selElemKey,
      panelL,
      panelR,
      tab,
      openGroup,
      search,
      treeCollapsed,
    };
    onViewState(state);
  }, [onViewState, selectedId, selPart, selElemKey, panelL, panelR, tab, openGroup, search, treeCollapsed]);

  // 선택된 섹션이 스택에서 사라지면(undo·외부 명령) 선택 해제
  useEffect(() => {
    if (selectedId && !S.stack.some((s) => s.id === selectedId)) {
      setSelectedId(null);
      setSelPart(null);
      setSelElemKey(null);
    }
  }, [S.stack, selectedId]);

  // 페이지 전환 시 선택 초기화
  useEffect(() => {
    setSelectedId(null);
    setSelPart(null);
    setSelElemKey(null);
    setAddAt(null);
    setAddPickerOpen(false);
  }, [S.curPage]);

  const dragDirty = useRef(false);
  const dragStartStack = useRef<typeof S.stack | null>(null);
  const lastSwapT = useRef(0);
  const dragRef = useRef<DragPayload | null>(null);
  dragRef.current = dragPayload;

  useEffect(() => {
    const onDragEnd = (e: DragEvent) => {
      const failed = e.dataTransfer?.dropEffect === "none";
      if (dragDirty.current) {
        dragDirty.current = false;
        const p = dragRef.current;
        if (failed && dragStartStack.current) {
          store.setStackLive(dragStartStack.current);
          store.setStatus("이동 취소 — 원래 위치로 복원");
        } else if (p?.kind === "move") {
          // 라이브 순서는 미러에만 있다 — 최종 인덱스 한 번의 이동 명령으로 확정한다.
          const idx = store.get().stack.findIndex((x) => x.id === p.id);
          if (idx >= 0) store.sectionMove(p.id, idx);
        }
      }
      dragStartStack.current = null;
      if (dragRef.current != null) setDragPayload(null);
      setDropIdx(null);
    };
    document.addEventListener("dragend", onDragEnd);
    return () => document.removeEventListener("dragend", onDragEnd);
  }, [store]);

  const scrollToSection = (id: string) => {
    setTimeout(() => {
      const el = rootRef.current?.querySelector(`[data-node="section/${id}"]`);
      if (!el) return;
      let c = el.parentElement;
      while (c && c.scrollHeight <= c.clientHeight + 1) c = c.parentElement;
      if (!c || c === rootRef.current) return;
      const er = el.getBoundingClientRect();
      const cr = c.getBoundingClientRect();
      if (er.top < cr.top + 30 || er.top > cr.bottom - 80) c.scrollBy({ top: er.top - cr.top - 60, behavior: "smooth" });
    }, 60);
  };

  const V: ViewApi = useMemo(
    () => ({
      selectedId,
      selPart,
      selElemKey,
      select: (id) => {
        setSelectedId(id);
        setSelPart(null);
        setSelElemKey(null);
        if (id === null) setAddAt(null);
        setAddPickerOpen(false);
      },
      pickPart: (sId, listKey, idx) => {
        setSelectedId(sId);
        setSelPart({ listKey, idx });
        setSelElemKey(null);
      },
      selectField: (sId, field) => {
        setSelectedId(sId);
        setSelPart(null);
        setSelElemKey(sId + ":" + field);
        scrollToSection(sId);
      },
      selectItem: (sId, listKey: PartListKey, idx) => {
        setSelectedId(sId);
        setSelPart({ listKey, idx });
        setSelElemKey(null);
        scrollToSection(sId);
      },
      selectColLink: (sId, ci, ii) => {
        setSelectedId(sId);
        setSelPart({ listKey: "cols", idx: ci });
        setSelElemKey(sId + ":cols:" + ci + ":" + ii);
        scrollToSection(sId);
      },
      clearPart: () => {
        setSelPart(null);
        setSelElemKey(null);
      },
      deselect: () => {
        if (selectedId || selPart || selElemKey) {
          setSelectedId(null);
          setSelPart(null);
          setSelElemKey(null);
          store.setStatus("페이지 속성");
        }
        setAddAt(null);
        setAddPickerOpen(false);
      },
      scrollToSection,
      dragPayload,
      dropIdx,
      setDrag: setDragPayload,
      setDropIdx,
      reorderStart: (id) => {
        dragDirty.current = false;
        dragStartStack.current = store.get().stack.slice();
        setDragPayload({ kind: "move", id });
      },
      reorderOver: (overId, before) => {
        const p = dragRef.current;
        if (!p || p.kind !== "move" || p.id === overId) return;
        if (Date.now() - lastSwapT.current < 180) return;
        const stack = store.get().stack;
        const from = stack.findIndex((x) => x.id === p.id);
        const tIdx = stack.findIndex((x) => x.id === overId);
        if (from < 0 || tIdx < 0) return;
        const ins = before ? tIdx : tIdx + 1;
        const next = moveTo(stack, p.id, ins);
        if (next.some((x, k) => x.id !== stack[k].id)) {
          dragDirty.current = true;
          lastSwapT.current = Date.now();
          store.setStackLive(next);
        }
      },
      addAt,
      setAddAt,
      addPickerOpen,
      setAddPickerOpen,
      mobNavOpen,
      mobTocOpen,
      setMobNav: setMobNavOpen,
      setMobToc: setMobTocOpen,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, selPart, selElemKey, dragPayload, dropIdx, addAt, addPickerOpen, mobNavOpen, mobTocOpen, store],
  );

  const L: LibraryUi = { panelL, setPanelL, libFlyout, setLibFlyout, tab, setTab, openGroup, setOpenGroup, search, setSearch };

  const sel = S.stack.find((s) => s.id === selectedId) ?? null;
  const panelROverlay = !panelR && !!sel;
  const showPanelR = panelR || panelROverlay;

  return (
    <div ref={rootRef} className="cs-root" style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0, overflow: "hidden" }}>
      <TopBar S={S} store={store} V={V} onPublish={onPublish} />
      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
        {!panelL ? <LibraryRail L={L} /> : null}
        {panelL || libFlyout ? <LibraryPanel S={S} store={store} V={V} L={L} /> : null}

        <Canvas S={S} store={store} V={V} />

        {showPanelR ? (
          <div
            style={{
              width: 288,
              flex: "none",
              background: "#ffffff",
              borderLeft: "1px solid #dde3ea",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              position: panelROverlay ? "absolute" : "relative",
              right: 0,
              top: 0,
              bottom: 0,
              zIndex: panelROverlay ? 45 : 1,
              boxShadow: panelROverlay ? "-14px 0 36px rgba(20,30,45,.2)" : "none",
            }}
          >
            <div style={{ flex: 1.3, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 13, minHeight: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8a94a3", textTransform: "uppercase", letterSpacing: ".06em", flex: 1 }}>속성 편집</div>
                {panelROverlay ? (
                  <>
                    <button className="hov-bg" title="사이드바로 고정" onClick={() => setPanelR(true)} style={{ width: 24, height: 24, border: "none", borderRadius: 6, background: "transparent", cursor: "pointer", fontSize: 11 }}>
                      📌
                    </button>
                    <button
                      className="hov-bg"
                      title="닫기"
                      onClick={() => V.select(null)}
                      style={{ width: 24, height: 24, border: "none", borderRadius: 6, background: "transparent", cursor: "pointer", fontSize: 11, color: "#8a94a3" }}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <button className="hov-bg" title="사이드바 접기" onClick={() => setPanelR(false)} style={{ width: 24, height: 24, border: "none", borderRadius: 6, background: "transparent", cursor: "pointer", fontSize: 12, color: "#8a94a3" }}>
                    ⟩
                  </button>
                )}
              </div>
              <InspectorBody S={S} store={store} V={V} />
            </div>
            <TreePanel S={S} V={V} collapsed={treeCollapsed} setCollapsed={setTreeCollapsed} />
          </div>
        ) : null}
        {!panelR && !panelROverlay ? <InspectorRail onExpand={() => setPanelR(true)} /> : null}
      </div>
    </div>
  );
}
