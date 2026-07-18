// 원격 스토어 — 뷰 런타임의 StudioFacade 구현. 권위는 컨트롤러 스토어이고, 여기는 자기
// 명령(plugin.<id>.*)을 브로커로 호출한 뒤 state 를 다시 당겨 미러를 갱신한다(폴링 없음 —
// 모든 갱신은 자기 행위의 후속이다. 이벤트 브리지가 열리면 외부 변경 push 구독을 더한다).
import type { Device, LogoMode, PageLayout, PartListKey, Section, SectionType } from "@/types";
import { PLUGIN_ID, type CommandOutcome, type ExecFn, type StudioFacade, type StudioState } from "@/store";

const SELF = `plugin.${PLUGIN_ID}.`;

const EMPTY: StudioState = {
  pages: [],
  curPage: "",
  stack: [],
  layout: "stack",
  history: [],
  historyIdx: 0,
  device: "desktop",
  pageDark: false,
  accent: "#2a6fdb",
  shellBrand: "Acme",
  logoMode: "both",
  logoIcon: 0,
  sideNav: [],
  sideFixed: false,
  mobBarFixed: false,
  statusMsg: "불러오는 중…",
  epoch: 0,
};

export class RemoteStudioStore implements StudioFacade {
  private exec: ExecFn;
  private state: StudioState = EMPTY;
  private listeners = new Set<() => void>();
  private chain: Promise<void> = Promise.resolve();

  constructor(exec: ExecFn) {
    this.exec = exec;
  }

  async init(): Promise<void> {
    await this.pull();
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  get(): StudioState {
    return this.state;
  }

  private notify(): void {
    for (const cb of this.listeners) cb();
  }

  private async pull(): Promise<void> {
    try {
      const out = await this.exec(SELF + "state", {});
      if (!out.ok || !out.data) return;
      const d = out.data as Record<string, unknown>;
      this.state = {
        pages: (d.pages as StudioState["pages"]) ?? [],
        curPage: String(d.curPage ?? ""),
        stack: (d.sections as Section[]) ?? [],
        layout: (d.layout as PageLayout) ?? "stack",
        history: (d.history as StudioState["history"]) ?? [],
        historyIdx: Number(d.historyIdx ?? 0),
        device: (d.device as Device) ?? "desktop",
        pageDark: d.pageDark === true,
        accent: String(d.accent ?? EMPTY.accent),
        shellBrand: String(d.shellBrand ?? "Acme"),
        logoMode: (d.logoMode as LogoMode) ?? "both",
        logoIcon: Number(d.logoIcon ?? 0),
        sideNav: ((d.sideNav as unknown[]) ?? []).map((x) => String(x)),
        sideFixed: d.sideFixed === true,
        mobBarFixed: d.mobBarFixed === true,
        statusMsg: String(d.statusMsg ?? ""),
        epoch: Number(d.epoch ?? 0),
      };
      this.notify();
    } catch (e) {
      console.error("[studio] state pull 실패:", e);
    }
  }

  /** 명령 실행 → state 재수화(순서 보존 체인). 실패 봉투는 statusMsg 로 노출. */
  private run(command: string, params?: Record<string, unknown>): void {
    this.chain = this.chain
      .then(async () => {
        let out: CommandOutcome;
        try {
          out = await this.exec(SELF + command, params ?? {});
        } catch (e) {
          out = { ok: false, code: "INTERNAL", message: e instanceof Error ? e.message : String(e) };
        }
        if (!out.ok) {
          this.state = { ...this.state, statusMsg: `${out.code}: ${out.message}` };
          this.notify();
        }
        await this.pull();
      })
      .catch(() => undefined);
  }

  // ── 뷰-로컬 라이브 프리뷰(권위 미변경) ──
  setStackLive(stack: Section[]): void {
    this.state = { ...this.state, stack };
    this.notify();
  }

  setStatus(msg: string): void {
    this.state = { ...this.state, statusMsg: msg };
    this.notify();
  }

  // ── 자기 명령으로의 변이 ──
  pageAdd(name?: string): void {
    this.run("page.add", name ? { name } : {});
  }
  pageOpen(ref: string): void {
    this.run("page.open", { page: ref });
  }
  reset(): void {
    this.run("reset");
  }
  sectionAdd(type: SectionType, variant?: number, index?: number | null): void {
    this.run("section.add", { type, ...(variant != null ? { variant } : {}), ...(index != null ? { index } : {}) });
  }
  sectionRemove(id: string): void {
    this.run("section.remove", { id });
  }
  sectionMove(id: string, index: number): void {
    this.run("section.move", { id, index });
  }
  sectionUpdate(id: string, patch: Partial<Section>, label?: string): void {
    this.run("section.update", { id, patch, ...(label ? { label } : {}) });
  }
  sectionSwap(id: string, variant?: number): void {
    this.run("section.swap", { id, ...(variant != null ? { variant } : {}) });
  }
  partAdd(id: string, listKey: PartListKey): void {
    this.run("part.add", { id, list: listKey });
  }
  partUpdate(id: string, listKey: PartListKey, idx: number, patch: Record<string, unknown>, label?: string): void {
    this.run("part.update", { id, list: listKey, index: idx, patch, ...(label ? { label } : {}) });
  }
  partRemove(id: string, listKey: PartListKey, idx: number): void {
    this.run("part.remove", { id, list: listKey, index: idx });
  }
  partMove(id: string, listKey: PartListKey, from: number, to: number): void {
    this.run("part.move", { id, list: listKey, from, to });
  }
  templateApply(name: string): void {
    this.run("template.apply", { name });
  }
  runAi(instruction: string, selectedId?: string | null): void {
    this.run("ai", { instruction, ...(selectedId ? { selectedId } : {}) });
  }
  undo(): void {
    this.run("undo");
  }
  redo(): void {
    this.run("redo");
  }
  historyRestore(version: number): void {
    this.run("history.restore", { version });
  }
  setDevice(device: Device): void {
    this.run("device.set", { device });
  }
  setDark(on: boolean): void {
    this.run("dark.set", { on });
  }
  setLayout(layout: PageLayout): void {
    this.run("layout.set", { layout });
  }
  setAccent(color: string): void {
    this.run("accent.set", { color });
  }
  setShell(patch: { shellBrand?: string; logoMode?: LogoMode; logoIcon?: number; sideNav?: string[] }): void {
    this.run("shell.set", {
      ...(patch.shellBrand !== undefined ? { brand: patch.shellBrand } : {}),
      ...(patch.logoMode !== undefined ? { logoMode: patch.logoMode } : {}),
      ...(patch.logoIcon !== undefined ? { logoIcon: patch.logoIcon } : {}),
      ...(patch.sideNav !== undefined ? { sideNav: patch.sideNav } : {}),
    });
  }
  setUiFlags(patch: { sideFixed?: boolean; mobBarFixed?: boolean }): void {
    this.run("flags.set", { ...patch });
  }
}
