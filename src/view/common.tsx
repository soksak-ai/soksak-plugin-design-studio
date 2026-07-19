// 뷰 공통 — 선택·드래그 상태 타입과 contentEditable 인라인 편집 요소.
import { createElement, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { PartListKey, SectionType } from "@/types";

export interface SelPart {
  listKey: PartListKey;
  idx: number;
}

export type DragPayload = { kind: "add"; type: SectionType } | { kind: "move"; id: string };

/** App 이 소유한 뷰-로컬 상태와 조작면 — 하위 컴포넌트는 이 인터페이스로만 접근. */
export interface ViewApi {
  selectedId: string | null;
  selPart: SelPart | null;
  selElemKey: string | null;
  select(id: string | null): void;
  pickPart(sId: string, listKey: PartListKey, idx: number): void;
  selectField(sId: string, field: string): void;
  selectItem(sId: string, listKey: PartListKey, idx: number): void;
  selectColLink(sId: string, ci: number, ii: number): void;
  clearPart(): void;
  deselect(): void;
  scrollToSection(id: string): void;

  dragPayload: DragPayload | null;
  dropIdx: number | null;
  setDrag(p: DragPayload | null): void;
  setDropIdx(i: number | null): void;
  reorderStart(id: string): void;
  reorderOver(overId: string, before: boolean): void;

  addAt: number | "end" | null;
  setAddAt(v: number | "end" | null): void;
  addPickerOpen: boolean;
  setAddPickerOpen(v: boolean): void;

  mobNavOpen: boolean;
  mobTocOpen: boolean;
  setMobNav(v: boolean): void;
  setMobToc(v: boolean): void;
}

export const stop = (e: MouseEvent) => e.stopPropagation();

/** contentEditable 인라인 편집 — key 리마운트(epoch)로 외부 변경을 반영, blur 에 커밋. */
export function Editable(props: {
  tag?: "span" | "h1" | "h2" | "p" | "button" | "div";
  k: string;
  text: string;
  style: CSSProperties;
  className?: string;
  /** DOM 투명성 — 노출 주소(data-node). 외부(ui.input.fill)가 인라인 편집을 구동한다. */
  node?: string;
  onCommit: (v: string) => void;
  onClick?: (e: MouseEvent) => void;
}): ReactNode {
  return createElement(
    props.tag ?? "span",
    {
      key: props.k,
      "data-node": props.node,
      contentEditable: true,
      suppressContentEditableWarning: true,
      spellCheck: false,
      draggable: false,
      className: props.className,
      style: props.style,
      onClick: props.onClick,
      onDragStart: (e: { preventDefault(): void; stopPropagation(): void }) => {
        e.preventDefault();
        e.stopPropagation();
      },
      onBlur: (e: { currentTarget: HTMLElement }) => {
        const v = e.currentTarget.textContent ?? "";
        if (v !== props.text) props.onCommit(v);
      },
    },
    props.text,
  );
}
