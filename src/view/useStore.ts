// 스토어 구독 훅 — useSyncExternalStore 로 이벤트 구동 리렌더(폴링 없음).
import { useSyncExternalStore } from "react";
import type { StudioStore, StudioState } from "@/store";

export function useStudio(store: StudioStore): StudioState {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.get(),
  );
}
