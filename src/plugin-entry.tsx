// soksak 디자인 스튜디오 — 격리 런타임 엔트리(정적 모듈). 컨트롤러 런타임이 문서 권위
// 스토어를 소유하고 commands 맵이 그것을 조작한다. 뷰 런타임은 별개 sandbox 문서라
// RemoteStudioStore 가 자기 명령으로 동기화한다. inventory(commands/views 키)는 매니페스트와
// exact-match(선언 ≡ 실제).
import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "@/view/App";
import { GLOBAL_CSS } from "@/styles";
import { StudioStore, type CommandOutcome, type ExecFn, type StudioFacade } from "@/store";
import { RemoteStudioStore } from "@/view/remoteStore";
import { buildCommands } from "@/commands";

interface RuntimeApp {
  commands?: { execute(command: string, params?: Record<string, unknown>): Promise<CommandOutcome> };
}
interface ControllerContext {
  app: RuntimeApp;
  signal: AbortSignal;
}
interface ViewContext {
  app: RuntimeApp;
  root: HTMLElement;
  signal: AbortSignal;
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

function mountApp(container: HTMLElement, store: StudioFacade) {
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
      <App store={store} />
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
      const store = new StudioStore({ exec });
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
        const execute = context.app.commands?.execute;
        if (execute) {
          const store = new RemoteStudioStore((command, params) => execute(command, params));
          await store.init();
          mountApp(context.root, store);
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
