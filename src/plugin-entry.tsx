// soksak 디자인 스튜디오 — SDK 정적 모듈 엔트리({controller, commands, views}). 컨트롤러가
// 문서 권위 스토어를 소유하고, 같은 창-realm 모듈 인스턴스라 뷰와 명령 핸들러가 그 스토어를
// 공유한다(라이브 뷰). 다른 창 변이는 kv.watch 재수화. inventory(commands/views 키)는
// 매니페스트와 exact-match(선언 ≡ 실제).
import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "@/view/App";
import { GLOBAL_CSS } from "@/styles";
import { StudioStore, type CommandOutcome, type ExecFn, type StudioFacade } from "@/store";
import { buildCommands } from "@/commands";

interface RuntimeApp {
  commands?: { execute(command: string, params?: Record<string, unknown>): Promise<CommandOutcome> };
  data?: { kv?: { watch?(cb: (key: string | null) => void): { dispose(): void } | (() => void) } };
}
interface ControllerContext {
  app: RuntimeApp;
  signal: AbortSignal;
}
interface ViewContext {
  app: RuntimeApp;
  root: HTMLElement;
  signal: AbortSignal;
  /** 복원 seam(B3) — 재시작 복원 마운트에 관찰됐던 뷰 상태가 돌아온다. 새 뷰는 null. */
  restore?: { cwd: string | null; state: unknown } | null;
  /** 뷰-로컬 관찰 상태 보고 — 뷰 레코드에 영속돼 restore.state 로 돌아온다(콘텐츠 배치 전용). */
  setRestoreState?: (state: unknown) => void;
}

class ErrBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state: { err: Error | null } = { err: null };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[studio] App 렌더 오류:", err, info.componentStack);
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 16, color: "#f88", fontFamily: "system-ui", fontSize: 13 }}>
          디자인 스튜디오 렌더 오류: {this.state.err.message || String(this.state.err)}
        </div>
      );
    }
    return this.props.children;
  }
}

// 컨트롤러 스토어 — activate 완료 전에 도착한 명령은 준비를 기다린다.
let resolveStore: (store: StudioStore) => void;
const storePromise = new Promise<StudioStore>((resolve) => {
  resolveStore = resolve;
});

// 뷰 마운트 — Shadow DOM 격리 렌더(디자인 전역 CSS 주입).
const mounts = new WeakMap<HTMLElement, Root>();

function mountApp(
  container: HTMLElement,
  store: StudioFacade,
  view?: { restore?: unknown; onViewState?: (state: unknown) => void },
) {
  unmountApp(container);
  container.style.position = "relative";
  const shadow = container.shadowRoot ?? container.attachShadow({ mode: "open" });
  shadow.replaceChildren();
  const style = document.createElement("style");
  style.textContent = GLOBAL_CSS;
  shadow.appendChild(style);
  const host = document.createElement("div");
  host.className = "studio-host";
  host.style.position = "absolute";
  host.style.inset = "0";
  host.style.overflow = "hidden";
  shadow.appendChild(host);
  const root = createRoot(host);
  root.render(
    <ErrBoundary>
      <App store={store} restore={view?.restore} onViewState={view?.onViewState} />
    </ErrBoundary>,
  );
  mounts.set(container, root);
}

function unmountApp(container: HTMLElement) {
  const root = mounts.get(container);
  if (!root) return;
  root.unmount();
  mounts.delete(container);
}

export default {
  controller: {
    async activate(context: ControllerContext): Promise<void> {
      const exec: ExecFn = async (command, params) => {
        const execute = context.app.commands?.execute;
        if (!execute) return { ok: false, code: "NO_BROKER", message: "command broker unavailable" };
        return execute(command, params);
      };
      const watch = context.app.data?.kv?.watch?.bind(context.app.data.kv);
      const store = new StudioStore({ exec, ...(watch ? { watch } : {}) });
      try {
        await store.init();
      } catch (e) {
        console.error("[studio] store init 실패(메모리 모드로 계속):", e);
      }
      resolveStore(store);
    },
  },

  commands: buildCommands(() => storePromise),

  views: {
    studio: {
      async mount(context: ViewContext): Promise<void> {
        if (context.app.commands?.execute) {
          // 창-realm 로더: 컨트롤러와 뷰가 같은 모듈 인스턴스 — 컨트롤러 스토어(단일 권위)를
          // 직접 구독한다. CLI/MCP 명령의 변이가 즉시 뷰에 반영된다(폴링 0, 원격 미러 불요).
          const store = await storePromise;
          mountApp(context.root, store, {
            restore: context.restore?.state,
            onViewState: context.setRestoreState?.bind(context),
          });
        } else {
          // preview role — 커맨드 표면이 없다. 로컬 시드 스토어로 정적 미리보기.
          const store = new StudioStore();
          await store.init();
          mountApp(context.root, store);
        }
      },
      unmount(context: ViewContext): void {
        unmountApp(context.root);
      },
    },
  },
};
