// 스토어 교차 창 동기화 계약 — kv.watch(전 창 broadcast)로 다른 창 변이를 즉시 재수화하고,
// 자기 쓰기 에코(writer 스탬프 일치)는 무시한다. 폴링 0.
import { describe, it, expect } from "vitest";
import { StudioStore, type CommandOutcome } from "@/store";

function kvHarness() {
  const kv = new Map<string, unknown>();
  let watchCb: ((key: string | null) => void) | null = null;
  const exec = async (command: string, params?: Record<string, unknown>): Promise<CommandOutcome> => {
    if (command === "data.kv.get") {
      return { ok: true, code: "OK", message: "", data: { value: (kv.get(String(params?.key)) as never) ?? null } };
    }
    if (command === "data.kv.set") {
      kv.set(String(params?.key), params?.value);
      return { ok: true, code: "OK", message: "" };
    }
    return { ok: false, code: "UNKNOWN_COMMAND", message: command };
  };
  const watch = (cb: (key: string | null) => void) => {
    watchCb = cb;
    return { dispose: () => (watchCb = null) };
  };
  return { kv, exec, watch, fire: (key: string | null) => watchCb?.(key) };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("StudioStore — 교차 창 kv 동기화", () => {
  it("다른 writer 의 doc 변경이 watch 로 즉시 반영된다", async () => {
    const h = kvHarness();
    const store = new StudioStore({ exec: h.exec, watch: h.watch });
    await store.init();
    expect(store.get().stack.length).toBe(6); // Landing 시드

    const doc = h.kv.get("doc") as Record<string, unknown>;
    expect(typeof doc.writer).toBe("string"); // 자기 쓰기 스탬프

    // 다른 창의 쓰기 시뮬레이션: writer 를 바꾸고 스택을 비운 문서
    h.kv.set("doc", {
      ...doc,
      writer: "other-window",
      pagesData: { p1: { stack: [], layout: "right" } },
      settings: { ...(doc.settings as object), pageDark: true, device: "mobile" },
    });
    h.fire("doc");
    await settle();

    const s = store.get();
    expect(s.stack.length).toBe(0);
    expect(s.layout).toBe("right");
    expect(s.pageDark).toBe(true);
    expect(s.device).toBe("mobile");
    expect(s.statusMsg).toBe("외부 변경 반영");
    // undo 로 외부 변경 전 스택으로 돌아갈 수 있다(히스토리에 쌓임)
    store.undo();
    expect(store.get().stack.length).toBe(6);
  });

  it("자기 쓰기 에코는 무시한다", async () => {
    const h = kvHarness();
    const store = new StudioStore({ exec: h.exec, watch: h.watch });
    await store.init();
    const before = store.get().epoch;
    h.fire("doc"); // 방금 자기(persist)가 쓴 값 — writer 일치
    await settle();
    expect(store.get().epoch).toBe(before);
  });

  it("dispose 가 watch 구독을 해제한다", async () => {
    const h = kvHarness();
    const store = new StudioStore({ exec: h.exec, watch: h.watch });
    await store.init();
    store.dispose();
    const doc = h.kv.get("doc") as Record<string, unknown>;
    h.kv.set("doc", { ...doc, writer: "other", pagesData: { p1: { stack: [], layout: "stack" } } });
    h.fire("doc");
    await settle();
    expect(store.get().stack.length).toBe(6); // 반영 안 됨
  });
});
