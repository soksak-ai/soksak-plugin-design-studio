// soksak 디자인 스튜디오 — SDK 정적 모듈 엔트리({controller, commands, views}). 컨트롤러가
// 문서 권위 스토어를 소유하고, 같은 창-realm 모듈 인스턴스라 뷰와 명령 핸들러가 그 스토어를
// 공유한다(라이브 뷰). 다른 창 변이는 kv.watch 재수화. inventory(commands/views 키)는
// 매니페스트와 exact-match(선언 ≡ 실제).
import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "@/view/App";
import { registerRailContainer, type RailSlot } from "@/view/railBridge";
import { GLOBAL_CSS } from "@/styles";
import { StudioStore, type CommandOutcome, type ExecFn, type StudioFacade } from "@/store";
import { buildCommands, type PublishIo } from "@/commands";
import { PLUGIN_ID } from "@/store";

interface RuntimeApp {
  commands?: { execute(command: string, params?: Record<string, unknown>): Promise<CommandOutcome> };
  data?: { kv?: { watch?(cb: (key: string | null) => void): { dispose(): void } | (() => void) } };
  fs?: { writeText?(path: string, content: string): Promise<void> };
  project?: { current?(): { id: string; root: string | null } | null };
}
interface ControllerContext {
  app: RuntimeApp;
  signal: AbortSignal;
}
interface ViewContext {
  app: RuntimeApp;
  root: HTMLElement;
  signal: AbortSignal;
  /** 콘텐츠 배치 뷰의 sessions view.id — per-view 레일 연결 키(studio 쪽). */
  viewId?: string | null;
  /** 레일 투영 마운트가 섬기는 결부 콘텐츠 뷰 id(코어 §4.4-lite — rail 뷰 쪽). */
  boundViewId?: string | null;
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

// 발행 IO — activate 에서 호스트 표면으로 채워진다(정적 commands 맵은 지연 접근).
let publishIo: PublishIo = {};

// 컨트롤러 스토어 — activate 완료 전에 도착한 명령은 준비를 기다린다.
let resolveStore: (store: StudioStore) => void;
const storeConstructed = new Promise<StudioStore>((resolve) => {
  resolveStore = resolve;
});

// 문서 복원은 **처음 필요할 때 한 번**이다.
//
// activate 는 등록이다. 코어는 그 호출을 기다리므로 거기서 하는 일은 그대로 부팅에 실린다 —
// 실측 2026-08-08: 창도 뷰도 없는데 이 플러그인이 activate 에서 자기 문서를 읽어 429ms 를
// 썼고, 문서가 없는 홈에서는 시드를 **쓰기**까지 했다. 그때 만든 스토어는 뷰가 열리기 전까지
// 아무도 안 본다.
//
// 명령과 뷰는 둘 다 이 자리를 지난다. 그래서 여기 한 번만 걸면 준비는 요구한 쪽이 유발하고,
// 아무도 요구하지 않으면 아무 일도 일어나지 않는다.
let storeReadying: Promise<StudioStore> | null = null;
const storeReady = (): Promise<StudioStore> =>
  (storeReadying ??= storeConstructed.then(async (store) => {
    try {
      await store.init();
    } catch (e) {
      console.error("[studio] store init 실패(메모리 모드로 계속):", e);
    }
    return store;
  }));

// 뷰 마운트 — Shadow DOM 격리 렌더(디자인 전역 CSS 주입).
const mounts = new WeakMap<HTMLElement, Root>();

function mountApp(
  container: HTMLElement,
  store: StudioFacade,
  view?: {
    restore?: unknown;
    onViewState?: (state: unknown) => void;
    onPublish?: () => void;
    viewId?: string | null;
  },
) {
  unmountApp(container);
  container.style.position = "relative";
  const shadow = container.shadowRoot ?? container.attachShadow({ mode: "open" });
  shadow.replaceChildren();
  const style = document.createElement("style");
  style.textContent = GLOBAL_CSS;
  shadow.appendChild(style);
  const host = document.createElement("div");
  host.className = "studio-body";
  host.style.position = "absolute";
  host.style.inset = "0";
  host.style.overflow = "hidden";
  shadow.appendChild(host);
  const root = createRoot(host);
  root.render(
    <ErrBoundary>
      <App
        store={store}
        restore={view?.restore}
        onViewState={view?.onViewState}
        onPublish={view?.onPublish}
        viewId={view?.viewId ?? null}
      />
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

const railCleanups = new WeakMap<HTMLElement, () => void>();

function railView(slot: RailSlot) {
  return {
    async mount(context: ViewContext): Promise<void> {
      railCleanups.get(context.root)?.();
      const shadow = context.root.shadowRoot ?? context.root.attachShadow({ mode: "open" });
      shadow.replaceChildren();
      const style = document.createElement("style");
      style.textContent = GLOBAL_CSS;
      shadow.appendChild(style);
      const host = document.createElement("div");
      host.className = "studio-rail-body";
      host.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;min-height:0;overflow:hidden;background:#fff";
      context.root.style.position = "relative";
      shadow.appendChild(host);
      const bound = context.boundViewId ?? null;
      if (!bound) {
        host.innerHTML =
          '<div style="padding:14px;font-size:11px;color:#8a94a3;text-align:center">디자인 스튜디오 결부 없음</div>';
        railCleanups.set(context.root, () => shadow.replaceChildren());
        return;
      }
      const off = registerRailContainer(bound, slot, host);
      railCleanups.set(context.root, () => {
        off();
        shadow.replaceChildren();
      });
    },
    unmount(context: ViewContext): void {
      railCleanups.get(context.root)?.();
      railCleanups.delete(context.root);
    },
  };
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
      const fsWrite = context.app.fs?.writeText?.bind(context.app.fs);
      const project = context.app.project;
      publishIo = {
        ...(fsWrite ? { writeText: fsWrite } : {}),
        projectRoot: () => project?.current?.()?.root ?? null,
      };
      // 만들기만 한다 — 문서는 처음 요구하는 쪽(명령·뷰)이 유발한다.
      resolveStore(new StudioStore({ exec, ...(watch ? { watch } : {}) }));
    },
  },

  commands: buildCommands(storeReady, () => publishIo),

  views: {
    // 방출된 사이드바(rail) — 컨테이너만 소유하고 내용은 결부 studio 의 App 이 포털로 그린다
    // (상태 단일 소유·이중 진실 0). 미결부(스튜디오 아님)면 정적 안내.
    library: railView("library"),
    inspector: railView("inspector"),
    studio: {
      async mount(context: ViewContext): Promise<void> {
        if (context.app.commands?.execute) {
          // 창-realm 로더: 컨트롤러와 뷰가 같은 모듈 인스턴스 — 컨트롤러 스토어(단일 권위)를
          // 직접 구독한다. CLI/MCP 명령의 변이가 즉시 뷰에 반영된다(폴링 0, 원격 미러 불요).
          const store = await storeReady();
          const execute = context.app.commands.execute;
          mountApp(context.root, store, {
            restore: context.restore?.state,
            onViewState: context.setRestoreState?.bind(context),
            onPublish: () => void execute(`plugin.${PLUGIN_ID}.publish`, {}),
            viewId: context.viewId ?? null,
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
