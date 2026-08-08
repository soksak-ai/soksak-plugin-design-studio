// 활성화 계약 — activate 는 등록이지 복원이 아니다.
//
// 코어는 `controller.activate` 를 기다린다. 그래서 거기서 하는 일은 그대로 부팅에 실린다 —
// 실측 2026-08-08: 창도 뷰도 없는 상태에서 이 플러그인이 activate 에서 자기 문서를 읽어
// 429ms 를 썼고, 문서가 없는 홈에서는 시드를 **쓰기**까지 했다. 그렇게 만든 스토어는 뷰가
// 열리기 전까지 아무도 안 본다.
//
// 준비는 요구한 쪽이 유발한다. 아무도 요구하지 않으면 아무 일도 일어나지 않아야 한다.
import { describe, it, expect, vi } from "vitest";
import entry from "@/plugin-entry";

function harness() {
  const execute = vi.fn(async (command: string) => {
    if (command === "data.kv.get") {
      return { ok: true, code: "OK", message: "", data: { value: null } };
    }
    if (command === "data.kv.set") return { ok: true, code: "OK", message: "" };
    return { ok: false, code: "UNKNOWN_COMMAND", message: command };
  });
  const context = {
    app: { commands: { execute }, data: {}, fs: {}, project: {} },
  } as never;
  return { execute, context };
}

const storeCalls = (execute: ReturnType<typeof vi.fn>) =>
  execute.mock.calls.filter(([command]) => String(command).startsWith("data.kv."));

// 스토어는 모듈 하나가 소유한다(컨트롤러와 뷰가 같은 인스턴스를 봐야 한다). 그래서 판정도 한
// 타임라인에서 한다 — 활성화를 두 번 하면 두 번째는 이미 준비된 스토어를 받아 아무것도 안
// 부르고, 그 침묵을 "복원 안 함" 으로 읽으면 통과가 거짓이 된다.
describe("activate 는 등록만 하고, 복원은 요구가 유발한다", () => {
  it("활성화는 저장소를 안 건드리고, 명령이 오면 그때 읽는다", async () => {
    const { execute, context } = harness();
    await entry.controller.activate(context);
    // 다음 틱까지 흘려 보낸다 — 늦게 도는 복원도 복원이다.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      storeCalls(execute),
      "활성화가 저장소를 건드렸다 — 등록은 등록만 한다",
    ).toEqual([]);

    const first = Object.keys(entry.commands)[0];
    await entry.commands[first]({});
    expect(
      storeCalls(execute).some(([command]) => command === "data.kv.get"),
      "요구가 왔는데도 복원하지 않았다",
    ).toBe(true);
  });
});
