// 레일 브리지 — 이 플러그인의 rail 뷰(library/inspector) 컨테이너를 결부된 studio 인스턴스에
// 연결한다(사이드바 방출 v1). 상태·드래그·선택은 studio(App)가 계속 소유하고, 렌더만 React
// 포털로 레일 컨테이너에 나간다. 키 = 결부 studio 콘텐츠 뷰의 viewId(ctx.boundViewId ↔
// studio ctx.viewId — per-view 인스턴스라 1:1).

export type RailSlot = "library" | "inspector";

const containers = new Map<string, Partial<Record<RailSlot, HTMLElement>>>();
const subs = new Map<string, Set<() => void>>();

function notify(viewId: string) {
  for (const fn of subs.get(viewId) ?? []) fn();
}

// rail 뷰 마운트가 자기 컨테이너를 등록한다. 반환 = 해제(언마운트 시).
export function registerRailContainer(
  viewId: string,
  slot: RailSlot,
  el: HTMLElement,
): () => void {
  const entry = containers.get(viewId) ?? {};
  entry[slot] = el;
  containers.set(viewId, entry);
  notify(viewId);
  return () => {
    const cur = containers.get(viewId);
    if (!cur || cur[slot] !== el) return;
    delete cur[slot];
    if (!cur.library && !cur.inspector) containers.delete(viewId);
    else containers.set(viewId, cur);
    notify(viewId);
  };
}

export function railContainer(
  viewId: string | null | undefined,
  slot: RailSlot,
): HTMLElement | null {
  if (!viewId) return null;
  return containers.get(viewId)?.[slot] ?? null;
}

// App 이 useSyncExternalStore 로 구독한다.
export function subscribeRail(viewId: string | null | undefined, fn: () => void): () => void {
  if (!viewId) return () => {};
  let set = subs.get(viewId);
  if (!set) {
    set = new Set();
    subs.set(viewId, set);
  }
  set.add(fn);
  return () => {
    const s = subs.get(viewId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) subs.delete(viewId);
  };
}
