// 명령 카탈로그 — 정적 handler 맵(신 격리 런타임). 키는 plugin.json contributes.commands 와
// exact-match(선언 ≡ 실제, lifecycle.ready inventory 대조). 파라미터 검증은 핸들러 소유
// (paramsAuthority=handler)이고 결과는 {ok, code, message, data} 봉투다.
import type { PartListKey, SectionType } from "@/types";
import { CATALOG, SECTION_TYPES, TEMPLATES } from "@/core/model";
import { ACCENT_OPTIONS, isSectionType, type CommandOutcome, type StudioStore } from "@/store";

type Handler = (params: Record<string, unknown>) => Promise<CommandOutcome>;

const PART_KEYS: readonly PartListKey[] = ["links", "cards", "plans", "faqs", "fields", "cols"];

// 레지스트리 프록시의 표준 답변은 message(data) 로 만든다 — data.message 에도 실어
// CLI/MCP 한 줄 답이 명령명으로 열화하지 않게 한다(MESSAGE-PROTOCOL §3).
const ok = (message: string, data?: Record<string, unknown>): CommandOutcome => ({
  ok: true,
  code: "OK",
  message,
  data: { ...(data ?? {}), message },
});
const err = (code: string, message: string): CommandOutcome => ({ ok: false, code, message });

const compactSection = (s: { id: string; type: SectionType; variant: number; bg: string; title?: string; vis?: string }) => ({
  id: s.id,
  type: s.type,
  variant: s.variant,
  variantLabel: CATALOG[s.type].variants[s.variant] ?? CATALOG[s.type].variants[0],
  bg: s.bg,
  title: s.title ?? "",
  vis: s.vis ?? "all",
});

/** 뷰 미러가 당겨 가는 전체 상태 — 원격 스토어(remoteStore)와의 유일한 계약. */
function fullState(store: StudioStore): Record<string, unknown> {
  const s = store.get();
  return {
    pages: s.pages,
    curPage: s.curPage,
    sections: s.stack,
    layout: s.layout,
    history: s.history,
    historyIdx: s.historyIdx,
    device: s.device,
    pageDark: s.pageDark,
    accent: s.accent,
    shellBrand: s.shellBrand,
    logoMode: s.logoMode,
    logoIcon: s.logoIcon,
    sideNav: s.sideNav,
    sideFixed: s.sideFixed,
    mobBarFixed: s.mobBarFixed,
    statusMsg: s.statusMsg,
    epoch: s.epoch,
  };
}

export function buildCommands(storeReady: () => Promise<StudioStore>): Record<string, Handler> {
  const withStore =
    (fn: (store: StudioStore, params: Record<string, unknown>) => CommandOutcome): Handler =>
    async (params) => {
      const store = await storeReady();
      try {
        return fn(store, params ?? {});
      } catch (e) {
        return err("INTERNAL", e instanceof Error ? e.message : String(e));
      }
    };

  return {
    ping: withStore(() => ok("디자인 스튜디오 v0.0.1 정상", { plugin: "soksak-plugin-design-studio", version: "0.0.1" })),

    state: withStore((store) => {
      const s = store.get();
      return ok(`페이지 ${s.pages.length}개 · 섹션 ${s.stack.length}개`, fullState(store));
    }),

    reset: withStore((store) => {
      store.reset();
      return ok("페이지를 비웠습니다", { sections: [] });
    }),

    "page.add": withStore((store, p) => {
      const page = store.pageAdd(p.name == null ? undefined : String(p.name));
      return ok(`페이지 '${page.name}' 추가됨`, { page });
    }),

    "page.list": withStore((store) => {
      const pages = store.get().pages;
      return ok(`페이지 ${pages.length}개`, { pages });
    }),

    "page.open": withStore((store, p) => {
      const page = store.pageOpen(String(p.page ?? ""));
      return page ? ok(`페이지 '${page.name}' 열림`, { page }) : err("NOT_FOUND", `page not found: '${String(p.page)}'`);
    }),

    "section.add": withStore((store, p) => {
      if (!isSectionType(p.type))
        return err("INVALID_TYPE", `unknown section type: '${String(p.type)}' — one of ${SECTION_TYPES.join(", ")}`);
      const vs = CATALOG[p.type].variants;
      const variant = p.variant == null ? 0 : Number(p.variant);
      if (!Number.isInteger(variant) || variant < 0 || variant >= vs.length)
        return err("INVALID_VARIANT", `variant out of range: ${String(p.variant)} (0..${vs.length - 1})`);
      const index = p.index == null ? null : Number(p.index);
      const section = compactSection(store.sectionAdd(p.type, variant, index));
      return ok(`${CATALOG[p.type].ko} 추가됨 (${section.id})`, { section });
    }),

    "section.list": withStore((store) => {
      const sections = store.get().stack.map(compactSection);
      return ok(`섹션 ${sections.length}개`, { sections });
    }),

    "section.update": withStore((store, p) => {
      const patch = p.patch;
      if (patch == null || typeof patch !== "object" || Array.isArray(patch)) return err("INVALID_PATCH", "patch must be an object");
      const allowed = ["title", "sub", "badge", "btn1", "btn2", "copy", "code", "bg", "vis", "padY", "padX", "padYM", "padXM", "images"];
      const bad = Object.keys(patch).filter((k) => !allowed.includes(k));
      if (bad.length) return err("INVALID_PATCH", `unknown fields: ${bad.join(", ")} — allowed: ${allowed.join(", ")}`);
      return store.sectionUpdate(String(p.id ?? ""), patch as Record<string, unknown>, typeof p.label === "string" ? p.label : undefined)
        ? ok("섹션 수정됨")
        : err("NOT_FOUND", `section not found: '${String(p.id)}'`);
    }),

    "section.remove": withStore((store, p) =>
      store.sectionRemove(String(p.id ?? "")) ? ok("섹션 삭제됨") : err("NOT_FOUND", `section not found: '${String(p.id)}'`),
    ),

    "section.move": withStore((store, p) =>
      store.sectionMove(String(p.id ?? ""), Number(p.index))
        ? ok("섹션 이동됨", { sections: store.get().stack.map(compactSection) })
        : err("NOT_FOUND", `section not found: '${String(p.id)}'`),
    ),

    "section.swap": withStore((store, p) => {
      const sec = store.sectionSwap(String(p.id ?? ""), p.variant == null ? undefined : Number(p.variant));
      if (!sec) return err("NOT_FOUND", `section not found: '${String(p.id)}'`);
      const section = compactSection(sec);
      return ok(`변형: ${section.variantLabel}`, { section });
    }),

    "part.add": withStore((store, p) => {
      if (!PART_KEYS.includes(p.list as PartListKey)) return err("INVALID_LIST", `list must be one of ${PART_KEYS.join(", ")}`);
      return store.partAdd(String(p.id ?? ""), p.list as PartListKey)
        ? ok("항목 추가됨")
        : err("NOT_FOUND", `section not found: '${String(p.id)}'`);
    }),

    "part.update": withStore((store, p) => {
      if (!PART_KEYS.includes(p.list as PartListKey)) return err("INVALID_LIST", `list must be one of ${PART_KEYS.join(", ")}`);
      if (p.patch == null || typeof p.patch !== "object" || Array.isArray(p.patch)) return err("INVALID_PATCH", "patch must be an object");
      return store.partUpdate(String(p.id ?? ""), p.list as PartListKey, Number(p.index), p.patch as Record<string, unknown>, typeof p.label === "string" ? p.label : undefined)
        ? ok("항목 수정됨")
        : err("NOT_FOUND", `section or item not found: '${String(p.id)}'[${String(p.index)}]`);
    }),

    "part.remove": withStore((store, p) => {
      if (!PART_KEYS.includes(p.list as PartListKey)) return err("INVALID_LIST", `list must be one of ${PART_KEYS.join(", ")}`);
      return store.partRemove(String(p.id ?? ""), p.list as PartListKey, Number(p.index))
        ? ok("항목 삭제됨")
        : err("NOT_FOUND", `section or item not found: '${String(p.id)}'[${String(p.index)}]`);
    }),

    "part.move": withStore((store, p) => {
      if (!PART_KEYS.includes(p.list as PartListKey)) return err("INVALID_LIST", `list must be one of ${PART_KEYS.join(", ")}`);
      return store.partMove(String(p.id ?? ""), p.list as PartListKey, Number(p.from), Number(p.to))
        ? ok("항목 이동됨")
        : err("OUT_OF_RANGE", `cannot move: '${String(p.id)}' ${String(p.from)}→${String(p.to)}`);
    }),

    "template.list": withStore(() =>
      ok(`템플릿 ${TEMPLATES.length}종`, {
        templates: TEMPLATES.map((t) => ({ name: t.name, recipe: t.recipe, count: t.spec.length })),
      }),
    ),

    "template.apply": withStore((store, p) => {
      const name = String(p.name ?? "");
      return store.templateApply(name)
        ? ok(`템플릿 ${name} 적용됨`, { name, sections: store.get().stack.map(compactSection) })
        : err("NOT_FOUND", `template not found: '${name}' — one of ${TEMPLATES.map((t) => t.name).join(", ")}`);
    }),

    ai: withStore((store, p) => {
      const r = store.runAi(String(p.instruction ?? ""), typeof p.selectedId === "string" ? p.selectedId : undefined);
      return ok(r.message, { action: r.action, sections: store.get().stack.map(compactSection) });
    }),

    undo: withStore((store) => {
      if (!store.undo()) return err("AT_OLDEST", "이미 가장 오래된 버전입니다");
      const s = store.get();
      return ok(s.statusMsg, { historyIdx: s.historyIdx });
    }),

    redo: withStore((store) => {
      if (!store.redo()) return err("AT_NEWEST", "이미 최신 버전입니다");
      const s = store.get();
      return ok(s.statusMsg, { historyIdx: s.historyIdx });
    }),

    "history.list": withStore((store) => {
      const history = store.historyList();
      return ok(`버전 ${history.length}개`, { history });
    }),

    "history.restore": withStore((store, p) => {
      const version = Number(p.version);
      return store.historyRestore(version) ? ok(`v${version} 복원됨`, { version }) : err("NOT_FOUND", `version not found: ${String(p.version)}`);
    }),

    "device.set": withStore((store, p) => {
      if (p.device !== "desktop" && p.device !== "mobile") return err("INVALID_DEVICE", "device must be desktop|mobile");
      store.setDevice(p.device);
      return ok(p.device === "mobile" ? "Mobile 미리보기" : "Desktop 미리보기", { device: p.device });
    }),

    "dark.set": withStore((store, p) => {
      const on = p.on === true || p.on === "true";
      store.setDark(on);
      return ok("다크 모드: " + (on ? "ON" : "OFF"), { on });
    }),

    "layout.set": withStore((store, p) => {
      if (p.layout !== "stack" && p.layout !== "left" && p.layout !== "right" && p.layout !== "both")
        return err("INVALID_LAYOUT", "layout must be stack|left|right|both");
      store.setLayout(p.layout);
      return ok("레이아웃: " + p.layout, { layout: p.layout });
    }),

    "accent.set": withStore((store, p) => {
      const color = String(p.color ?? "");
      if (!/^#[0-9a-fA-F]{6}$/.test(color))
        return err("INVALID_COLOR", `color must be #rrggbb — 기본 팔레트: ${ACCENT_OPTIONS.join(", ")}`);
      store.setAccent(color);
      return ok("액센트 컬러: " + color, { color });
    }),

    "shell.set": withStore((store, p) => {
      const patch: Parameters<StudioStore["setShell"]>[0] = {};
      if (typeof p.brand === "string" && p.brand.trim()) patch.shellBrand = p.brand.trim();
      if (p.logoMode === "text" || p.logoMode === "icon" || p.logoMode === "both") patch.logoMode = p.logoMode;
      if (p.logoIcon != null && Number.isInteger(Number(p.logoIcon))) patch.logoIcon = Math.max(0, Math.min(3, Number(p.logoIcon)));
      if (Array.isArray(p.sideNav)) patch.sideNav = (p.sideNav as unknown[]).map((x) => String(x));
      if (Object.keys(patch).length === 0)
        return err("INVALID_PARAMS", "one of brand|logoMode(text|icon|both)|logoIcon(0..3)|sideNav[] required");
      store.setShell(patch);
      return ok("셸 설정 변경됨", { ...patch });
    }),

    "flags.set": withStore((store, p) => {
      const patch: Parameters<StudioStore["setUiFlags"]>[0] = {};
      if (typeof p.sideFixed === "boolean") patch.sideFixed = p.sideFixed;
      if (typeof p.mobBarFixed === "boolean") patch.mobBarFixed = p.mobBarFixed;
      if (Object.keys(patch).length === 0) return err("INVALID_PARAMS", "one of sideFixed|mobBarFixed(boolean) required");
      store.setUiFlags(patch);
      return ok(store.get().statusMsg, { ...patch });
    }),
  };
}
