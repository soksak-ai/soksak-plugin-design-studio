// 스토어 — app.data(SQLite) 위 in-memory 미러. 단일 진실은 app.data "pages"·"settings" 컬렉션.
// 변이: core/model 순수 op → 미러 갱신·notify → 변경 페이지만 영속. data.watch 로 다른 창 변경 시
// 재수화(이벤트 구동 — 폴링 없음). 히스토리(undo/redo)는 창 세션 소유라 영속하지 않는다.
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

export interface Disposable {
  dispose(): void;
}

export interface DataApi {
  define(coll: string, opts: { indexes?: string[]; fts?: string[] }): Promise<void>;
  put(coll: string, doc: Record<string, unknown>, opts?: { id?: string }): Promise<string>;
  delete(coll: string, id: string): Promise<boolean>;
  query(coll: string, opts?: { where?: Record<string, unknown>; order?: string; limit?: number }): Promise<unknown[]>;
  watch(coll: string, opts: undefined | Record<string, never>, cb: (e: unknown) => void): Disposable | (() => void);
}

export interface AppLike {
  data?: DataApi;
}

const PAGES_COLL = "pages";
const SETTINGS_COLL = "settings";
const SETTINGS_ID = "studio";
export const ACCENT_OPTIONS = ["#2a6fdb", "#1f8a5b", "#d97757", "#7b5bd6"] as const;
export const SIDE_NAV_DEFAULT = ["대시보드", "프로젝트", "멤버", "설정"];

interface PageState {
  stack: Section[];
  layout: PageLayout;
  history: HistoryEntry[];
  historyIdx: number;
}

export interface StudioState {
  pages: PageMeta[];
  curPage: string;
  /** 현재 페이지의 작업 상태(미러) — pagesData[curPage] 와 동기. */
  stack: Section[];
  layout: PageLayout;
  history: HistoryEntry[];
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

type Listener = () => void;

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

export class StudioStore {
  private app: AppLike;
  private listeners = new Set<Listener>();
  private subs: Array<Disposable | (() => void)> = [];
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
  private snapshot: StudioState | null = null;
  /** 외부발 스택 교체(커밋·undo·페이지 전환·재수화)마다 증가 — contentEditable 리마운트 키. */
  private epoch = 0;

  constructor(app: AppLike) {
    this.app = app;
  }

  // ── 구독 ──
  subscribe(cb: Listener): () => void {
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
        pages: this.pages,
        curPage: this.curPage,
        stack: p.stack,
        layout: p.layout,
        history: p.history,
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

  // ── 초기화·영속 ──
  async init(): Promise<void> {
    const data = this.app.data;
    if (!data) {
      this.seedInitial();
      this.notify();
      return;
    }
    await data.define(PAGES_COLL, { indexes: ["order"] });
    await data.define(SETTINGS_COLL, {});
    await this.hydrate();
    if (this.pages.length === 0) {
      this.seedInitial();
      await this.persistPage(this.curPage);
      await this.persistSettings();
    }
    const onChange = () => {
      void this.hydrate().then(() => {
        this.epoch += 1;
        this.notify();
      });
    };
    this.subs.push(data.watch(PAGES_COLL, undefined, onChange));
    this.subs.push(data.watch(SETTINGS_COLL, undefined, onChange));
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

  private async hydrate(): Promise<void> {
    const data = this.app.data;
    if (!data) return;
    const rows = (await data.query(PAGES_COLL, { order: "order" })) as Array<Record<string, unknown>>;
    const pages: PageMeta[] = [];
    for (const r of rows) {
      const id = typeof r.id === "string" ? r.id : null;
      if (!id) continue;
      pages.push({ id, name: typeof r.name === "string" ? r.name : id });
      const stack = Array.isArray(r.stack) ? (r.stack as Section[]) : [];
      const layout = (["stack", "left", "right", "both"] as const).includes(r.layout as PageLayout)
        ? (r.layout as PageLayout)
        : "stack";
      const prev = this.pagesData.get(id);
      if (prev && JSON.stringify(prev.stack) === JSON.stringify(stack) && prev.layout === layout) continue;
      this.pagesData.set(id, {
        stack,
        layout,
        history: prev ? pushHistory(prev.history, prev.historyIdx, "외부 변경 반영", stack).history : [{ label: "불러옴", stack: clone(stack) }],
        historyIdx: prev ? Math.min(prev.historyIdx + 1, 29) : 0,
      });
    }
    if (pages.length > 0) {
      this.pages = pages;
      if (!pages.some((p) => p.id === this.curPage)) this.curPage = pages[0].id;
    }
    const settings = (await data.query(SETTINGS_COLL, {})) as Array<Record<string, unknown>>;
    const s = settings.find((x) => x.id === SETTINGS_ID);
    if (s) {
      if (typeof s.accent === "string") this.accent = s.accent;
      if (typeof s.shellBrand === "string") this.shellBrand = s.shellBrand;
      if (s.logoMode === "text" || s.logoMode === "icon" || s.logoMode === "both") this.logoMode = s.logoMode;
      if (typeof s.logoIcon === "number") this.logoIcon = s.logoIcon;
      if (Array.isArray(s.sideNav)) this.sideNav = (s.sideNav as unknown[]).map((x) => String(x));
      if (s.device === "desktop" || s.device === "mobile") this.device = s.device;
      if (typeof s.pageDark === "boolean") this.pageDark = s.pageDark;
    }
    this.uid = maxSectionUid([...this.pagesData.values()].map((p) => p.stack)) + 1;
  }

  private async persistPage(pageId: string): Promise<void> {
    const data = this.app.data;
    if (!data) return;
    const p = this.pagesData.get(pageId);
    const meta = this.pages.find((x) => x.id === pageId);
    if (!p || !meta) return;
    const order = this.pages.findIndex((x) => x.id === pageId);
    await data.put(PAGES_COLL, { id: pageId, name: meta.name, order, layout: p.layout, stack: p.stack }, { id: pageId });
  }

  private async persistSettings(): Promise<void> {
    const data = this.app.data;
    if (!data) return;
    await data.put(
      SETTINGS_COLL,
      {
        id: SETTINGS_ID,
        accent: this.accent,
        shellBrand: this.shellBrand,
        logoMode: this.logoMode,
        logoIcon: this.logoIcon,
        sideNav: this.sideNav,
        device: this.device,
        pageDark: this.pageDark,
      },
      { id: SETTINGS_ID },
    );
  }

  dispose(): void {
    for (const s of this.subs) typeof s === "function" ? s() : s.dispose();
    this.subs = [];
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
    void this.persistPage(this.curPage);
    this.notify();
  }

  /** 히스토리 없이 스택만 교체(슬라이더 라이브 프리뷰) — 커밋은 commitLive 로. */
  setStackLive(nextStack: Section[]): void {
    this.cur().stack = nextStack;
    this.notify();
  }

  commitLive(label: string): void {
    this.commit(this.cur().stack.slice(), label);
  }

  // ── 페이지 ──
  pageList(): Array<PageMeta & { count: number; active: boolean }> {
    return this.pages.map((p) => ({
      ...p,
      count: (this.pagesData.get(p.id)?.stack ?? []).length,
      active: p.id === this.curPage,
    }));
  }

  pageAdd(name?: string): PageMeta {
    const id = "p" + Date.now();
    const meta = { id, name: name?.trim() || "page-" + (this.pages.length + 1) };
    this.pages = this.pages.concat([meta]);
    this.pagesData.set(id, { stack: [], layout: "stack", history: [{ label: "새 페이지", stack: [] }], historyIdx: 0 });
    this.curPage = id;
    this.statusMsg = "페이지 추가: " + meta.name;
    void this.persistPage(id);
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
      this.notify();
    }
    return p;
  }

  reset(): void {
    this.commit([], "페이지 초기화");
  }

  // ── 섹션 ──
  sectionAdd(type: SectionType, variant: number | undefined, index: number | null | undefined): Section {
    const sec = makeSection(type, variant ?? 0, this.nextSectionId);
    this.commit(insertAt(this.cur().stack, sec, index), CATALOG[type].ko + " 추가");
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

  /** AI 지시 실행 — selectedId 는 뷰의 선택(없으면 첫 섹션 기준). */
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
    void this.persistPage(this.curPage);
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
    void this.persistPage(this.curPage);
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
    void this.persistPage(this.curPage);
    this.notify();
    return true;
  }

  // ── 전역 설정 ──
  setDevice(device: Device): void {
    this.device = device;
    this.statusMsg = device === "mobile" ? "Mobile 미리보기" : "Desktop 미리보기";
    void this.persistSettings();
    this.notify();
  }

  setDark(on: boolean): void {
    this.pageDark = on;
    this.statusMsg = "다크 모드: " + (on ? "ON" : "OFF");
    void this.persistSettings();
    this.notify();
  }

  setLayout(layout: PageLayout): void {
    const p = this.cur();
    p.layout = layout;
    this.statusMsg =
      "레이아웃: " + LAYOUT_LABELS[layout] + (layout !== "stack" ? " — 모바일에서 자동으로 접힙니다" : "");
    void this.persistPage(this.curPage);
    this.notify();
  }

  setAccent(color: string): void {
    this.accent = color;
    this.statusMsg = "액센트 컬러: " + color;
    void this.persistSettings();
    this.notify();
  }

  setShell(patch: { shellBrand?: string; logoMode?: LogoMode; logoIcon?: number; sideNav?: string[] }): void {
    if (patch.shellBrand !== undefined) this.shellBrand = patch.shellBrand;
    if (patch.logoMode !== undefined) this.logoMode = patch.logoMode;
    if (patch.logoIcon !== undefined) this.logoIcon = patch.logoIcon;
    if (patch.sideNav !== undefined) this.sideNav = patch.sideNav;
    void this.persistSettings();
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
    this.notify();
  }

  setStatus(msg: string): void {
    this.statusMsg = msg;
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

export function createStore(app: AppLike): StudioStore {
  return new StudioStore(app);
}
