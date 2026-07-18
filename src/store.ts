// 컨트롤러 스토어 — 문서의 단일 권위. 컨트롤러 런타임 모듈 스코프에 살고, 모든 명령 핸들러가
// 이 스토어를 조작한다. 영속은 브로커 명령(data.kv.get/set, ns=플러그인 id) 하나의 키로 한다.
// 뷰 런타임은 별개 문서라 이 스토어를 직접 만지지 못한다 — 자기 명령(plugin.<id>.*)으로만
// 조작하고 view/remoteStore 미러가 상태를 당겨온다(StudioFacade 로 동형).
import type {
  AiAction,
  Device,
  HistoryEntry,
  LogoMode,
  PageLayout,
  PageMeta,
  PartListKey,
  Section,
  SectionType,
} from "@/types";
import {
  CATALOG,
  SECTION_TYPES,
  TEMPLATES,
  addPart,
  buildFromSpec,
  cycleVariant,
  insertAt,
  makeSection,
  moveTo,
  movePart,
  parseAi,
  pushHistory,
  removeById,
  removePart,
  updateById,
  updatePartById,
} from "@/core/model";

export const PLUGIN_ID = "soksak-plugin-design-studio";
export const ACCENT_OPTIONS = ["#2a6fdb", "#1f8a5b", "#d97757", "#7b5bd6"] as const;
export const SIDE_NAV_DEFAULT = ["대시보드", "프로젝트", "멤버", "설정"];
const DOC_KEY = "doc";

export interface CommandOutcome {
  ok: boolean;
  code: string;
  message: string;
  data?: Record<string, unknown>;
}

/** 레지스트리 브로커 실행 함수 — 컨트롤러는 ctx.app.commands.execute, 하니스는 미주입. */
export type ExecFn = (command: string, params?: Record<string, unknown>) => Promise<CommandOutcome>;

export interface PageRow extends PageMeta {
  count: number;
  active: boolean;
}

export interface HistoryMeta {
  label: string;
  count: number;
}

export interface StudioState {
  pages: PageRow[];
  curPage: string;
  stack: Section[];
  layout: PageLayout;
  history: HistoryMeta[];
  historyIdx: number;
  device: Device;
  pageDark: boolean;
  accent: string;
  shellBrand: string;
  logoMode: LogoMode;
  logoIcon: number;
  sideNav: string[];
  sideFixed: boolean;
  mobBarFixed: boolean;
  statusMsg: string;
  epoch: number;
}

/** 뷰가 보는 조작면 — 컨트롤러 스토어(권위)와 원격 미러가 공히 구현한다. */
export interface StudioFacade {
  get(): StudioState;
  subscribe(cb: () => void): () => void;
  setStatus(msg: string): void;
  /** 히스토리 없이 로컬 스택만 교체(슬라이더·드래그 라이브 프리뷰). 확정은 개별 명령으로. */
  setStackLive(stack: Section[]): void;
  pageAdd(name?: string): void;
  pageOpen(ref: string): void;
  reset(): void;
  sectionAdd(type: SectionType, variant?: number, index?: number | null): void;
  sectionRemove(id: string): void;
  sectionMove(id: string, index: number): void;
  sectionUpdate(id: string, patch: Partial<Section>, label?: string): void;
  sectionSwap(id: string, variant?: number): void;
  partAdd(id: string, listKey: PartListKey): void;
  partUpdate(id: string, listKey: PartListKey, idx: number, patch: Record<string, unknown>, label?: string): void;
  partRemove(id: string, listKey: PartListKey, idx: number): void;
  partMove(id: string, listKey: PartListKey, from: number, to: number): void;
  templateApply(name: string): void;
  runAi(instruction: string, selectedId?: string | null): void;
  undo(): void;
  redo(): void;
  historyRestore(version: number): void;
  setDevice(device: Device): void;
  setDark(on: boolean): void;
  setLayout(layout: PageLayout): void;
  setAccent(color: string): void;
  setShell(patch: { shellBrand?: string; logoMode?: LogoMode; logoIcon?: number; sideNav?: string[] }): void;
  setUiFlags(patch: { sideFixed?: boolean; mobBarFixed?: boolean }): void;
}

interface PageState {
  stack: Section[];
  layout: PageLayout;
  history: HistoryEntry[];
  historyIdx: number;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function maxSectionUid(stacks: Section[][]): number {
  let max = 0;
  for (const st of stacks)
    for (const s of st) {
      const m = /^s(\d+)$/.exec(s.id);
      if (m) max = Math.max(max, Number(m[1]));
    }
  return max;
}

export class StudioStore implements StudioFacade {
  private exec: ExecFn | null;
  private listeners = new Set<() => void>();
  private uid = 1;
  private pagesData = new Map<string, PageState>();
  private pages: PageMeta[] = [];
  private curPage = "p1";
  private device: Device = "desktop";
  private pageDark = false;
  private accent: string = ACCENT_OPTIONS[0];
  private shellBrand = "Acme";
  private logoMode: LogoMode = "both";
  private logoIcon = 0;
  private sideNav: string[] = SIDE_NAV_DEFAULT.slice();
  private sideFixed = false;
  private mobBarFixed = false;
  private statusMsg = "";
  private epoch = 0;
  private snapshot: StudioState | null = null;
  private persistChain: Promise<void> = Promise.resolve();

  constructor(opts?: { exec?: ExecFn }) {
    this.exec = opts?.exec ?? null;
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    this.snapshot = null;
    for (const cb of this.listeners) cb();
  }

  get(): StudioState {
    if (!this.snapshot) {
      const p = this.cur();
      this.snapshot = {
        pages: this.pages.map((m) => ({
          ...m,
          count: (this.pagesData.get(m.id)?.stack ?? []).length,
          active: m.id === this.curPage,
        })),
        curPage: this.curPage,
        stack: p.stack,
        layout: p.layout,
        history: p.history.map((h) => ({ label: h.label, count: h.stack.length })),
        historyIdx: p.historyIdx,
        device: this.device,
        pageDark: this.pageDark,
        accent: this.accent,
        shellBrand: this.shellBrand,
        logoMode: this.logoMode,
        logoIcon: this.logoIcon,
        sideNav: this.sideNav,
        sideFixed: this.sideFixed,
        mobBarFixed: this.mobBarFixed,
        statusMsg: this.statusMsg,
        epoch: this.epoch,
      };
    }
    return this.snapshot;
  }

  private cur(): PageState {
    let p = this.pagesData.get(this.curPage);
    if (!p) {
      p = { stack: [], layout: "stack", history: [{ label: "새 페이지", stack: [] }], historyIdx: 0 };
      this.pagesData.set(this.curPage, p);
    }
    return p;
  }

  nextSectionId = (): string => "s" + this.uid++;

  // ── 초기화·영속(kv 단일 키) ──
  async init(): Promise<void> {
    const loaded = await this.load();
    if (!loaded) {
      this.seedInitial();
      this.persist();
    }
    this.notify();
  }

  private seedInitial(): void {
    const stack = buildFromSpec(TEMPLATES[0].spec, this.nextSectionId);
    this.pages = [{ id: "p1", name: "untitled-page" }];
    this.curPage = "p1";
    this.pagesData.set("p1", {
      stack,
      layout: "stack",
      history: [{ label: "초기 템플릿: Landing", stack: clone(stack) }],
      historyIdx: 0,
    });
    this.statusMsg = "템플릿 Landing 적용됨";
  }

  private async load(): Promise<boolean> {
    if (!this.exec) return false;
    try {
      const out = await this.exec("data.kv.get", { ns: PLUGIN_ID, key: DOC_KEY });
      const value = out.ok ? (out.data?.value as Record<string, unknown> | null | undefined) : null;
      if (!value || typeof value !== "object") return false;
      const pages = Array.isArray(value.pages) ? (value.pages as PageMeta[]) : [];
      if (pages.length === 0) return false;
      this.pages = pages.map((p) => ({ id: String(p.id), name: String(p.name) }));
      const pd = (value.pagesData ?? {}) as Record<string, { stack?: Section[]; layout?: PageLayout }>;
      this.pagesData.clear();
      for (const p of this.pages) {
        const row = pd[p.id] ?? {};
        const stack = Array.isArray(row.stack) ? row.stack : [];
        const layout = (["stack", "left", "right", "both"] as const).includes(row.layout as PageLayout)
          ? (row.layout as PageLayout)
          : "stack";
        this.pagesData.set(p.id, {
          stack,
          layout,
          history: [{ label: "불러옴", stack: clone(stack) }],
          historyIdx: 0,
        });
      }
      const cur = typeof value.curPage === "string" ? value.curPage : this.pages[0].id;
      this.curPage = this.pages.some((p) => p.id === cur) ? cur : this.pages[0].id;
      const s = (value.settings ?? {}) as Record<string, unknown>;
      if (typeof s.accent === "string") this.accent = s.accent;
      if (typeof s.shellBrand === "string") this.shellBrand = s.shellBrand;
      if (s.logoMode === "text" || s.logoMode === "icon" || s.logoMode === "both") this.logoMode = s.logoMode;
      if (typeof s.logoIcon === "number") this.logoIcon = s.logoIcon;
      if (Array.isArray(s.sideNav)) this.sideNav = (s.sideNav as unknown[]).map((x) => String(x));
      if (s.device === "desktop" || s.device === "mobile") this.device = s.device;
      if (typeof s.pageDark === "boolean") this.pageDark = s.pageDark;
      if (typeof s.sideFixed === "boolean") this.sideFixed = s.sideFixed;
      if (typeof s.mobBarFixed === "boolean") this.mobBarFixed = s.mobBarFixed;
      this.uid = maxSectionUid([...this.pagesData.values()].map((p) => p.stack)) + 1;
      this.statusMsg = "문서 불러옴";
      return true;
    } catch (e) {
      console.error("[studio] 문서 로드 실패:", e);
      return false;
    }
  }

  /** 커밋 시마다 문서 전체를 kv 한 키로 직렬화 — 쓰기 순서는 체인으로 보존. */
  private persist(): void {
    const exec = this.exec;
    if (!exec) return;
    const doc = {
      v: 1,
      pages: this.pages,
      curPage: this.curPage,
      pagesData: Object.fromEntries(
        [...this.pagesData.entries()].map(([id, p]) => [id, { stack: p.stack, layout: p.layout }]),
      ),
      settings: {
        accent: this.accent,
        shellBrand: this.shellBrand,
        logoMode: this.logoMode,
        logoIcon: this.logoIcon,
        sideNav: this.sideNav,
        device: this.device,
        pageDark: this.pageDark,
        sideFixed: this.sideFixed,
        mobBarFixed: this.mobBarFixed,
      },
    };
    this.persistChain = this.persistChain
      .then(() => exec("data.kv.set", { ns: PLUGIN_ID, key: DOC_KEY, value: clone(doc) }))
      .then((out) => {
        if (!out.ok) console.error("[studio] 문서 저장 거부:", out.code, out.message);
      })
      .catch((e) => console.error("[studio] 문서 저장 실패:", e));
  }

  dispose(): void {
    this.listeners.clear();
  }

  // ── 커밋(히스토리+영속) ──
  commit(nextStack: Section[], label: string): void {
    const p = this.cur();
    const r = pushHistory(p.history, p.historyIdx, label, nextStack);
    p.stack = nextStack;
    p.history = r.history;
    p.historyIdx = r.historyIdx;
    this.epoch += 1;
    this.statusMsg = label;
    this.persist();
    this.notify();
  }

  setStackLive(nextStack: Section[]): void {
    this.cur().stack = nextStack;
    this.notify();
  }

  setStatus(msg: string): void {
    this.statusMsg = msg;
    this.notify();
  }

  // ── 페이지 ──
  pageAdd(name?: string): PageMeta {
    const id = "p" + Date.now();
    const meta = { id, name: name?.trim() || "page-" + (this.pages.length + 1) };
    this.pages = this.pages.concat([meta]);
    this.pagesData.set(id, { stack: [], layout: "stack", history: [{ label: "새 페이지", stack: [] }], historyIdx: 0 });
    this.curPage = id;
    this.epoch += 1;
    this.statusMsg = "페이지 추가: " + meta.name;
    this.persist();
    this.notify();
    return meta;
  }

  pageOpen(ref: string): PageMeta | null {
    const p = this.pages.find((x) => x.id === ref) ?? this.pages.find((x) => x.name === ref);
    if (!p) return null;
    if (p.id !== this.curPage) {
      this.curPage = p.id;
      this.epoch += 1;
      this.statusMsg = "페이지 전환: " + p.name;
      this.persist();
      this.notify();
    }
    return p;
  }

  reset(): void {
    this.commit([], "페이지 초기화");
  }

  // ── 섹션 ──
  sectionAdd(type: SectionType, variant?: number, index?: number | null): Section {
    const sec = makeSection(type, variant ?? 0, this.nextSectionId);
    this.commit(insertAt(this.cur().stack, sec, index ?? null), CATALOG[type].ko + " 추가");
    return sec;
  }

  sectionRemove(id: string): boolean {
    const p = this.cur();
    const sec = p.stack.find((s) => s.id === id);
    if (!sec) return false;
    this.commit(removeById(p.stack, id), sec.type + " 삭제");
    return true;
  }

  sectionMove(id: string, index: number): boolean {
    const p = this.cur();
    const next = moveTo(p.stack, id, index);
    if (next === p.stack) return false;
    const sec = p.stack.find((s) => s.id === id)!;
    this.commit(next, sec.type + " 이동");
    return true;
  }

  sectionUpdate(id: string, patch: Partial<Section>, label?: string): boolean {
    const p = this.cur();
    if (!p.stack.some((s) => s.id === id)) return false;
    this.commit(updateById(p.stack, id, patch), label ?? "텍스트 수정");
    return true;
  }

  sectionSwap(id: string, variant?: number): Section | null {
    const p = this.cur();
    const sec = p.stack.find((s) => s.id === id);
    if (!sec) return null;
    const vs = CATALOG[sec.type].variants;
    const next =
      variant != null
        ? updateById(p.stack, id, { variant: ((variant % vs.length) + vs.length) % vs.length })
        : cycleVariant(p.stack, id);
    const v = next.find((s) => s.id === id)!.variant;
    this.commit(next, sec.type + " 변형: " + vs[v]);
    return next.find((s) => s.id === id)!;
  }

  // ── 부분(part) ──
  partAdd(id: string, listKey: PartListKey): boolean {
    const p = this.cur();
    if (!p.stack.some((s) => s.id === id)) return false;
    this.commit(addPart(p.stack, id, listKey), PART_LABELS[listKey] + " 추가");
    return true;
  }

  partUpdate(id: string, listKey: PartListKey, idx: number, patch: Record<string, unknown>, label?: string): boolean {
    const sec = this.cur().stack.find((s) => s.id === id);
    const arr = (sec?.[listKey] as unknown[] | undefined) ?? [];
    if (!sec || idx < 0 || idx >= arr.length) return false;
    this.commit(updatePartById(this.cur().stack, id, listKey, idx, patch), label ?? PART_LABELS[listKey] + " 수정");
    return true;
  }

  partRemove(id: string, listKey: PartListKey, idx: number): boolean {
    const sec = this.cur().stack.find((s) => s.id === id);
    const arr = (sec?.[listKey] as unknown[] | undefined) ?? [];
    if (!sec || idx < 0 || idx >= arr.length) return false;
    this.commit(removePart(this.cur().stack, id, listKey, idx), PART_LABELS[listKey] + " 삭제");
    return true;
  }

  partMove(id: string, listKey: PartListKey, from: number, to: number): boolean {
    const p = this.cur();
    const next = movePart(p.stack, id, listKey, from, to);
    if (next === p.stack) return false;
    this.commit(next, PART_LABELS[listKey] + " 이동");
    return true;
  }

  // ── 템플릿·AI ──
  templateApply(name: string): boolean {
    const t = TEMPLATES.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!t) return false;
    this.commit(buildFromSpec(t.spec, this.nextSectionId), "템플릿 " + t.name + " 적용");
    return true;
  }

  runAi(instruction: string, selectedId?: string | null): { action: AiAction; message: string } {
    const p = this.cur();
    const action = parseAi(instruction, p.stack);
    switch (action.kind) {
      case "template": {
        this.templateApply(action.name);
        this.statusMsg = "AI: 템플릿 " + action.name + " 적용";
        this.notify();
        return { action, message: this.statusMsg };
      }
      case "add": {
        this.sectionAdd(action.type, 0, null);
        this.statusMsg = "AI: " + CATALOG[action.type].ko + " 추가됨";
        this.notify();
        return { action, message: this.statusMsg };
      }
      case "remove": {
        const idx = p.stack.findIndex((s) => s.type === action.type);
        if (idx >= 0) {
          this.commit(removeById(p.stack, p.stack[idx].id), "AI: " + CATALOG[action.type].ko + " 삭제");
        } else {
          this.statusMsg = "AI: 해당 섹션이 없습니다";
          this.notify();
        }
        return { action, message: this.statusMsg };
      }
      case "dark": {
        const id = selectedId || p.stack[0]?.id;
        if (id) this.commit(updateById(p.stack, id, { bg: "#0f172a" }), "AI: 배경 어둡게");
        return { action, message: this.statusMsg };
      }
      case "swap": {
        const sec = p.stack.find((s) => s.type === action.type);
        if (sec) this.sectionSwap(sec.id);
        return { action, message: this.statusMsg };
      }
      default: {
        this.statusMsg = 'AI: "추가/삭제/교체/어둡게/템플릿 ○○ 적용" 형태로 지시해 보세요';
        this.notify();
        return { action, message: this.statusMsg };
      }
    }
  }

  // ── 히스토리 ──
  undo(): boolean {
    const p = this.cur();
    if (p.historyIdx <= 0) return false;
    const label = p.history[p.historyIdx].label;
    p.historyIdx -= 1;
    p.stack = clone(p.history[p.historyIdx].stack);
    this.epoch += 1;
    this.statusMsg = "실행취소: " + label;
    this.persist();
    this.notify();
    return true;
  }

  redo(): boolean {
    const p = this.cur();
    if (p.historyIdx >= p.history.length - 1) return false;
    p.historyIdx += 1;
    p.stack = clone(p.history[p.historyIdx].stack);
    this.epoch += 1;
    this.statusMsg = "다시실행: " + p.history[p.historyIdx].label;
    this.persist();
    this.notify();
    return true;
  }

  historyList(): Array<{ version: number; label: string; count: number; current: boolean }> {
    const p = this.cur();
    return p.history.map((h, i) => ({ version: i + 1, label: h.label, count: h.stack.length, current: i === p.historyIdx }));
  }

  historyRestore(version: number): boolean {
    const p = this.cur();
    const i = version - 1;
    if (i < 0 || i >= p.history.length) return false;
    p.historyIdx = i;
    p.stack = clone(p.history[i].stack);
    this.epoch += 1;
    this.statusMsg = "v" + version + " 복원됨";
    this.persist();
    this.notify();
    return true;
  }

  // ── 전역 설정 ──
  setDevice(device: Device): void {
    this.device = device;
    this.statusMsg = device === "mobile" ? "Mobile 미리보기" : "Desktop 미리보기";
    this.persist();
    this.notify();
  }

  setDark(on: boolean): void {
    this.pageDark = on;
    this.statusMsg = "다크 모드: " + (on ? "ON" : "OFF");
    this.persist();
    this.notify();
  }

  setLayout(layout: PageLayout): void {
    const p = this.cur();
    p.layout = layout;
    this.statusMsg = "레이아웃: " + LAYOUT_LABELS[layout] + (layout !== "stack" ? " — 모바일에서 자동으로 접힙니다" : "");
    this.persist();
    this.notify();
  }

  setAccent(color: string): void {
    this.accent = color;
    this.statusMsg = "액센트 컬러: " + color;
    this.persist();
    this.notify();
  }

  setShell(patch: { shellBrand?: string; logoMode?: LogoMode; logoIcon?: number; sideNav?: string[] }): void {
    if (patch.shellBrand !== undefined) this.shellBrand = patch.shellBrand;
    if (patch.logoMode !== undefined) this.logoMode = patch.logoMode;
    if (patch.logoIcon !== undefined) this.logoIcon = patch.logoIcon;
    if (patch.sideNav !== undefined) this.sideNav = patch.sideNav;
    this.persist();
    this.notify();
  }

  setUiFlags(patch: { sideFixed?: boolean; mobBarFixed?: boolean }): void {
    if (patch.sideFixed !== undefined) {
      this.sideFixed = patch.sideFixed;
      this.statusMsg = "사이드바 고정: " + (patch.sideFixed ? "ON" : "OFF");
    }
    if (patch.mobBarFixed !== undefined) {
      this.mobBarFixed = patch.mobBarFixed;
      this.statusMsg = "모바일 상단 바 고정: " + (patch.mobBarFixed ? "ON" : "OFF");
    }
    this.persist();
    this.notify();
  }
}

export const PART_LABELS: Record<PartListKey, string> = {
  plans: "요금제 플랜",
  cards: "기능 카드",
  faqs: "FAQ 항목",
  links: "내비 링크",
  fields: "폼 필드",
  cols: "푸터 컬럼",
};

export const LAYOUT_LABELS: Record<PageLayout, string> = {
  stack: "기본 스택",
  left: "좌측 사이드바",
  right: "우측 사이드바",
  both: "좌+우 사이드바",
};

export function isSectionType(v: unknown): v is SectionType {
  return typeof v === "string" && (SECTION_TYPES as string[]).includes(v);
}
