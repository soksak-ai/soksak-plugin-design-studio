// soksak 디자인 스튜디오 플러그인 엔트리 — loader 가 blob-URL 로 import 하는 단일 ESM.
// 뷰는 Shadow DOM 에 마운트(soksak chrome 격리). 헤드리스 커맨드는 뷰 미오픈에도 동작 —
// sok plugin.soksak-plugin-design-studio.* / MCP / 소켓 E2E.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "@/view/App";
import { GLOBAL_CSS } from "@/styles";
import { createStore, type StudioStore } from "@/store";
import { registerCommands, type AppCtx } from "@/commands";

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

const mounts = new WeakMap<HTMLElement, { root: Root; shadow: ShadowRoot }>();
let store: StudioStore | null = null;

function mountApp(container: HTMLElement) {
  unmountApp(container);
  container.style.position = "relative";

  const shadow = container.shadowRoot ?? container.attachShadow({ mode: "open" });
  shadow.replaceChildren();

  const style = document.createElement("style");
  style.textContent = GLOBAL_CSS;
  shadow.appendChild(style);

  const host = document.createElement("div");
  host.className = "studio-root";
  host.style.position = "absolute";
  host.style.inset = "0";
  host.style.overflow = "hidden";
  shadow.appendChild(host);

  try {
    const root = createRoot(host);
    root.render(<ErrBoundary>{store ? <App store={store} /> : <div>스토어 초기화 실패</div>}</ErrBoundary>);
    mounts.set(container, { root, shadow });
  } catch (e) {
    host.textContent = "[studio] mount 실패: " + (e instanceof Error ? e.message : String(e));
    host.style.color = "#f88";
    host.style.padding = "16px";
    host.style.font = "13px system-ui";
    console.error("[studio] mount 실패:", e);
  }
}

function unmountApp(container: HTMLElement) {
  const state = mounts.get(container);
  if (!state) return;
  state.root.unmount();
  mounts.delete(container);
}

export default {
  activate(ctx: AppCtx & { app: { ui?: { registerView(id: string, spec: object): { dispose(): void } } } }) {
    const app = ctx.app as AppCtx["app"] & {
      data?: ConstructorParameters<typeof StudioStore>[0]["data"];
      ui?: { registerView(id: string, spec: object): { dispose(): void } };
    };

    store = createStore({ data: app.data });
    void store.init().catch((e) => console.error("[studio] store init 실패:", e));
    ctx.subscriptions.push({ dispose: () => store?.dispose() });

    if (app.ui?.registerView) {
      ctx.subscriptions.push(
        app.ui.registerView("studio", {
          mount(container: HTMLElement) {
            mountApp(container);
          },
          unmount(container: HTMLElement) {
            unmountApp(container);
          },
        }),
      );
    }

    registerCommands(ctx, store);
  },
  deactivate() {
    store?.dispose();
    store = null;
  },
};
