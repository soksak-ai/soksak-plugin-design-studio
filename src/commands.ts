// 명령 카탈로그 — 전부 같은 스토어를 조작. app.commands.register 로 CLI/MCP 자동노출.
// 등록 key 는 plugin.json contributes.commands 와 exact-match(선언 ≡ 실제).
import type { PartListKey, SectionType } from "@/types";
import { CATALOG, SECTION_TYPES, TEMPLATES } from "@/core/model";
import { ACCENT_OPTIONS, isSectionType, type StudioStore } from "@/store";

interface ParamSpec {
  type: "string" | "number" | "boolean" | "json";
  description: string;
  required?: boolean;
  enum?: readonly string[];
  default?: unknown;
}
interface CommandSpec {
  description: string;
  params?: Record<string, ParamSpec>;
  returns?: string;
  danger?: "destructive" | "inject";
  examples?: readonly string[];
  message?: (d: any) => string;
  handler: (params: Record<string, unknown>) => Promise<object> | object;
}
interface CommandsApi {
  register(name: string, spec: CommandSpec): { dispose(): void } | (() => void);
}
export interface AppCtx {
  app: { commands?: CommandsApi };
  subscriptions: Array<{ dispose(): void } | (() => void)>;
}

const PART_KEYS: readonly PartListKey[] = ["links", "cards", "plans", "faqs", "fields", "cols"];
const err = (code: string, message: string) => ({ ok: false, code, message });

const compactSection = (s: { id: string; type: SectionType; variant: number; bg: string; title?: string; vis?: string }) => ({
  id: s.id,
  type: s.type,
  variant: s.variant,
  variantLabel: CATALOG[s.type].variants[s.variant] ?? CATALOG[s.type].variants[0],
  bg: s.bg,
  title: s.title ?? "",
  vis: s.vis ?? "all",
});

export function registerCommands(ctx: AppCtx, store: StudioStore): void {
  const commands = ctx.app.commands;
  if (!commands?.register) return;
  const reg = (name: string, spec: CommandSpec) => ctx.subscriptions.push(commands.register(name, spec));

  reg("ping", {
    description: "플러그인 적재/버전 확인(E2E)",
    message: (d) => `디자인 스튜디오 v${d.version} 정상`,
    handler: () => ({ ok: true, plugin: "soksak-plugin-design-studio", version: "0.0.1" }),
  });

  reg("state", {
    description: "문서 상태 스냅샷 — 페이지 목록·현재 페이지·섹션 스택·미리보기 설정",
    returns: "{ pages, curPage, sections, layout, device, pageDark, accent, historyLen, historyIdx, statusMsg }",
    handler: () => {
      const s = store.get();
      return {
        ok: true,
        pages: store.pageList(),
        curPage: s.curPage,
        sections: s.stack.map(compactSection),
        layout: s.layout,
        device: s.device,
        pageDark: s.pageDark,
        accent: s.accent,
        historyLen: s.history.length,
        historyIdx: s.historyIdx,
        statusMsg: s.statusMsg,
      };
    },
  });

  reg("reset", {
    description: "현재 페이지의 섹션을 전부 비운다(히스토리에 남아 undo 가능)",
    danger: "destructive",
    message: () => "페이지를 비웠습니다",
    handler: () => {
      store.reset();
      return { ok: true, sections: [] };
    },
  });

  reg("page.add", {
    description: "페이지를 추가하고 그 페이지로 전환",
    params: { name: { type: "string", description: "페이지 이름(생략 시 page-N)" } },
    message: (d) => `페이지 '${d.page.name}' 추가됨`,
    handler: (p) => ({ ok: true, page: store.pageAdd(p.name == null ? undefined : String(p.name)) }),
  });

  reg("page.list", {
    description: "페이지 목록(섹션 수·활성 여부 포함)",
    message: (d) => `페이지 ${d.pages.length}개`,
    handler: () => ({ ok: true, pages: store.pageList() }),
  });

  reg("page.open", {
    description: "페이지 전환(id 또는 이름)",
    params: { page: { type: "string", description: "페이지 id 또는 이름", required: true } },
    message: (d) => `페이지 '${d.page.name}' 열림`,
    handler: (p) => {
      const page = store.pageOpen(String(p.page ?? ""));
      return page ? { ok: true, page } : err("NOT_FOUND", `page not found: '${String(p.page)}'`);
    },
  });

  reg("section.add", {
    description: "섹션 추가 — 23종 타입, 변형·위치 지정 가능",
    params: {
      type: { type: "string", description: "섹션 타입", required: true, enum: SECTION_TYPES },
      variant: { type: "number", description: "변형 인덱스(기본 0)" },
      index: { type: "number", description: "삽입 위치(생략 시 끝)" },
    },
    examples: ['section.add {"type":"Hero"}', 'section.add {"type":"Pricing","variant":1,"index":2}'],
    message: (d) => `${CATALOG[d.section.type as SectionType].ko} 추가됨 (${d.section.id})`,
    handler: (p) => {
      if (!isSectionType(p.type))
        return err("INVALID_TYPE", `unknown section type: '${String(p.type)}' — one of ${SECTION_TYPES.join(", ")}`);
      const vs = CATALOG[p.type].variants;
      const variant = p.variant == null ? 0 : Number(p.variant);
      if (!Number.isInteger(variant) || variant < 0 || variant >= vs.length)
        return err("INVALID_VARIANT", `variant out of range: ${String(p.variant)} (0..${vs.length - 1})`);
      const index = p.index == null ? null : Number(p.index);
      return { ok: true, section: compactSection(store.sectionAdd(p.type, variant, index)) };
    },
  });

  reg("section.list", {
    description: "현재 페이지의 섹션 목록(순서대로)",
    message: (d) => `섹션 ${d.sections.length}개`,
    handler: () => ({ ok: true, sections: store.get().stack.map(compactSection) }),
  });

  reg("section.update", {
    description: "섹션 필드 수정 — title/sub/badge/btn1/btn2/copy/code/bg/vis/padY/padX/padYM/padXM",
    params: {
      id: { type: "string", description: "섹션 id", required: true },
      patch: { type: "json", description: "수정할 필드 객체", required: true },
    },
    examples: ['section.update {"id":"s1","patch":{"title":"새 제목"}}', 'section.update {"id":"s2","patch":{"bg":"#0f172a"}}'],
    message: () => "섹션 수정됨",
    handler: (p) => {
      const patch = p.patch;
      if (patch == null || typeof patch !== "object" || Array.isArray(patch))
        return err("INVALID_PATCH", "patch must be an object");
      const allowed = ["title", "sub", "badge", "btn1", "btn2", "copy", "code", "bg", "vis", "padY", "padX", "padYM", "padXM"];
      const bad = Object.keys(patch).filter((k) => !allowed.includes(k));
      if (bad.length) return err("INVALID_PATCH", `unknown fields: ${bad.join(", ")} — allowed: ${allowed.join(", ")}`);
      const ok = store.sectionUpdate(String(p.id ?? ""), patch as Record<string, unknown>);
      return ok ? { ok: true } : err("NOT_FOUND", `section not found: '${String(p.id)}'`);
    },
  });

  reg("section.remove", {
    description: "섹션 삭제",
    params: { id: { type: "string", description: "섹션 id", required: true } },
    danger: "destructive",
    message: () => "섹션 삭제됨",
    handler: (p) =>
      store.sectionRemove(String(p.id ?? "")) ? { ok: true } : err("NOT_FOUND", `section not found: '${String(p.id)}'`),
  });

  reg("section.move", {
    description: "섹션을 지정 인덱스로 이동",
    params: {
      id: { type: "string", description: "섹션 id", required: true },
      index: { type: "number", description: "목표 인덱스", required: true },
    },
    message: () => "섹션 이동됨",
    handler: (p) =>
      store.sectionMove(String(p.id ?? ""), Number(p.index))
        ? { ok: true, sections: store.get().stack.map(compactSection) }
        : err("NOT_FOUND", `section not found: '${String(p.id)}'`),
  });

  reg("section.swap", {
    description: "섹션 변형 교체 — variant 생략 시 다음 변형으로 순환",
    params: {
      id: { type: "string", description: "섹션 id", required: true },
      variant: { type: "number", description: "변형 인덱스(생략 시 순환)" },
    },
    message: (d) => `변형: ${d.section.variantLabel}`,
    handler: (p) => {
      const sec = store.sectionSwap(String(p.id ?? ""), p.variant == null ? undefined : Number(p.variant));
      return sec ? { ok: true, section: compactSection(sec) } : err("NOT_FOUND", `section not found: '${String(p.id)}'`);
    },
  });

  reg("part.add", {
    description: "섹션 내부 리스트 항목 추가(links/cards/plans/faqs/fields/cols)",
    params: {
      id: { type: "string", description: "섹션 id", required: true },
      list: { type: "string", description: "리스트 키", required: true, enum: PART_KEYS },
    },
    message: () => "항목 추가됨",
    handler: (p) => {
      if (!PART_KEYS.includes(p.list as PartListKey)) return err("INVALID_LIST", `list must be one of ${PART_KEYS.join(", ")}`);
      return store.partAdd(String(p.id ?? ""), p.list as PartListKey)
        ? { ok: true }
        : err("NOT_FOUND", `section not found: '${String(p.id)}'`);
    },
  });

  reg("part.update", {
    description: "섹션 내부 리스트 항목 수정 — plans:{tier,price,d,btn,featured} cards:{t,d} links/faqs:{t} fields:{t,tall} cols:{h,items}",
    params: {
      id: { type: "string", description: "섹션 id", required: true },
      list: { type: "string", description: "리스트 키", required: true, enum: PART_KEYS },
      index: { type: "number", description: "항목 인덱스(0부터)", required: true },
      patch: { type: "json", description: "수정할 필드 객체", required: true },
    },
    examples: ['part.update {"id":"s3","list":"plans","index":1,"patch":{"price":"₩29,000"}}'],
    message: () => "항목 수정됨",
    handler: (p) => {
      if (!PART_KEYS.includes(p.list as PartListKey)) return err("INVALID_LIST", `list must be one of ${PART_KEYS.join(", ")}`);
      if (p.patch == null || typeof p.patch !== "object" || Array.isArray(p.patch))
        return err("INVALID_PATCH", "patch must be an object");
      return store.partUpdate(String(p.id ?? ""), p.list as PartListKey, Number(p.index), p.patch as Record<string, unknown>)
        ? { ok: true }
        : err("NOT_FOUND", `section or item not found: '${String(p.id)}'[${String(p.index)}]`);
    },
  });

  reg("part.remove", {
    description: "섹션 내부 리스트 항목 삭제",
    params: {
      id: { type: "string", description: "섹션 id", required: true },
      list: { type: "string", description: "리스트 키", required: true, enum: PART_KEYS },
      index: { type: "number", description: "항목 인덱스(0부터)", required: true },
    },
    danger: "destructive",
    message: () => "항목 삭제됨",
    handler: (p) => {
      if (!PART_KEYS.includes(p.list as PartListKey)) return err("INVALID_LIST", `list must be one of ${PART_KEYS.join(", ")}`);
      return store.partRemove(String(p.id ?? ""), p.list as PartListKey, Number(p.index))
        ? { ok: true }
        : err("NOT_FOUND", `section or item not found: '${String(p.id)}'[${String(p.index)}]`);
    },
  });

  reg("template.list", {
    description: "템플릿 목록(레시피·섹션 수)",
    message: (d) => `템플릿 ${d.templates.length}종`,
    handler: () => ({
      ok: true,
      templates: TEMPLATES.map((t) => ({ name: t.name, recipe: t.recipe, count: t.spec.length })),
    }),
  });

  reg("template.apply", {
    description: "템플릿 적용 — 현재 페이지 스택을 교체(히스토리에 남아 undo 가능)",
    params: { name: { type: "string", description: "템플릿 이름", required: true, enum: TEMPLATES.map((t) => t.name) } },
    message: (d) => `템플릿 ${d.name} 적용됨`,
    handler: (p) => {
      const name = String(p.name ?? "");
      return store.templateApply(name)
        ? { ok: true, name, sections: store.get().stack.map(compactSection) }
        : err("NOT_FOUND", `template not found: '${name}' — one of ${TEMPLATES.map((t) => t.name).join(", ")}`);
    },
  });

  reg("ai", {
    description: "자연어 지시 실행 — 추가/삭제/교체/어둡게/템플릿 ○○ 적용",
    params: { instruction: { type: "string", description: "지시문", required: true } },
    examples: ['ai {"instruction":"히어로 추가"}', 'ai {"instruction":"템플릿 SaaS Pricing 적용"}'],
    message: (d) => d.message,
    handler: (p) => {
      const r = store.runAi(String(p.instruction ?? ""));
      return { ok: true, action: r.action, message: r.message, sections: store.get().stack.map(compactSection) };
    },
  });

  reg("undo", {
    description: "실행취소",
    message: (d) => d.statusMsg,
    handler: () => {
      const ok = store.undo();
      const s = store.get();
      return ok
        ? { ok: true, statusMsg: s.statusMsg, historyIdx: s.historyIdx }
        : err("AT_OLDEST", "이미 가장 오래된 버전입니다");
    },
  });

  reg("redo", {
    description: "다시실행",
    message: (d) => d.statusMsg,
    handler: () => {
      const ok = store.redo();
      const s = store.get();
      return ok
        ? { ok: true, statusMsg: s.statusMsg, historyIdx: s.historyIdx }
        : err("AT_NEWEST", "이미 최신 버전입니다");
    },
  });

  reg("history.list", {
    description: "버전 히스토리(현재 버전 표시)",
    message: (d) => `버전 ${d.history.length}개`,
    handler: () => ({ ok: true, history: store.historyList() }),
  });

  reg("history.restore", {
    description: "지정 버전으로 복원",
    params: { version: { type: "number", description: "버전 번호(history.list 의 version)", required: true } },
    message: (d) => `v${d.version} 복원됨`,
    handler: (p) => {
      const version = Number(p.version);
      return store.historyRestore(version)
        ? { ok: true, version }
        : err("NOT_FOUND", `version not found: ${String(p.version)}`);
    },
  });

  reg("device.set", {
    description: "미리보기 기기 전환",
    params: { device: { type: "string", description: "desktop | mobile", required: true, enum: ["desktop", "mobile"] } },
    message: (d) => (d.device === "mobile" ? "Mobile 미리보기" : "Desktop 미리보기"),
    handler: (p) => {
      if (p.device !== "desktop" && p.device !== "mobile") return err("INVALID_DEVICE", "device must be desktop|mobile");
      store.setDevice(p.device);
      return { ok: true, device: p.device };
    },
  });

  reg("dark.set", {
    description: "페이지 다크 모드 on/off",
    params: { on: { type: "boolean", description: "true=다크", required: true } },
    message: (d) => "다크 모드: " + (d.on ? "ON" : "OFF"),
    handler: (p) => {
      store.setDark(p.on === true || p.on === "true");
      return { ok: true, on: store.get().pageDark };
    },
  });

  reg("layout.set", {
    description: "페이지 레이아웃 — stack | left | right | both",
    params: {
      layout: { type: "string", description: "레이아웃", required: true, enum: ["stack", "left", "right", "both"] },
    },
    message: (d) => "레이아웃: " + d.layout,
    handler: (p) => {
      if (p.layout !== "stack" && p.layout !== "left" && p.layout !== "right" && p.layout !== "both")
        return err("INVALID_LAYOUT", "layout must be stack|left|right|both");
      store.setLayout(p.layout);
      return { ok: true, layout: p.layout };
    },
  });

  reg("accent.set", {
    description: "액센트 컬러(#rrggbb) — 기본 팔레트: " + ACCENT_OPTIONS.join(", "),
    params: { color: { type: "string", description: "#rrggbb", required: true } },
    message: (d) => "액센트 컬러: " + d.color,
    handler: (p) => {
      const color = String(p.color ?? "");
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) return err("INVALID_COLOR", "color must be #rrggbb");
      store.setAccent(color);
      return { ok: true, color };
    },
  });
}
