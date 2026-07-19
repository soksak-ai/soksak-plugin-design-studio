// 코어 모델 — 문서의 순수 연산만 담는다.
// UI 에서 분리한 단일 진실. DOM·React·app.* 을 모른다.
import type {
  AiAction,
  CardItem,
  CatalogEntry,
  FieldItem,
  FootCol,
  HistoryEntry,
  PartListKey,
  PlanItem,
  Section,
  SectionType,
  TemplateSpec,
  TextItem,
} from "@/types";

export const CATALOG: Record<SectionType, CatalogEntry> = {
  Navbar: { ko: "내비게이션", glyph: "NAV", variants: ["기본", "CTA 강조"] },
  Hero: { ko: "히어로", glyph: "HERO", variants: ["센터 정렬", "좌우 분할", "미니멀"] },
  Features: { ko: "기능 소개", glyph: "FEAT", variants: ["3열 카드", "2열 카드"] },
  Gallery: { ko: "갤러리", glyph: "IMG", variants: ["그리드"] },
  Pricing: { ko: "가격표", glyph: "PRC", variants: ["3단", "2단"] },
  Testimonial: { ko: "고객 후기", glyph: "QUO", variants: ["인용 카드", "3열 카드"] },
  Form: { ko: "문의 폼", glyph: "FORM", variants: ["기본"] },
  Faq: { ko: "FAQ", glyph: "FAQ", variants: ["아코디언"] },
  Cta: { ko: "CTA 배너", glyph: "CTA", variants: ["라이트", "컬러 반전"] },
  Footer: { ko: "푸터", glyph: "FTR", variants: ["멀티 컬럼"] },
  Columns: { ko: "레이아웃", glyph: "COL", variants: ["2단 컬럼", "3단 컬럼", "텍스트+이미지", "이미지+텍스트"] },
  Diagram: { ko: "다이어그램", glyph: "MMD", variants: ["Mermaid"] },
  Divider: { ko: "구분선", glyph: "DIV", variants: ["실선", "여백", "라벨 구분선"] },
  Stats: { ko: "지표", glyph: "NUM", variants: ["4열", "3열"] },
  Logos: { ko: "로고 클라우드", glyph: "LOGO", variants: ["텍스트 로고"] },
  Team: { ko: "팀 소개", glyph: "TEAM", variants: ["그리드"] },
  Steps: { ko: "단계", glyph: "STEP", variants: ["가로 3단계"] },
  Video: { ko: "비디오", glyph: "VID", variants: ["16:9"] },
  Blog: { ko: "블로그 카드", glyph: "BLOG", variants: ["3열 카드"] },
  Banner: { ko: "공지 배너", glyph: "BAR", variants: ["기본"] },
  Breadcrumb: { ko: "브레드크럼", glyph: "PATH", variants: ["기본"] },
  Table: { ko: "데이터 테이블", glyph: "TBL", variants: ["기본"] },
  List: { ko: "리스트 뷰", glyph: "LIST", variants: ["기본"] },
};

export const SECTION_TYPES = Object.keys(CATALOG) as SectionType[];

export const TEMPLATES: TemplateSpec[] = [
  {
    name: "Landing",
    recipe: "nav·hero·feat·quo·cta·ftr",
    spec: [["Navbar", 0], ["Hero", 1], ["Features", 0], ["Testimonial", 0], ["Cta", 1], ["Footer", 0]],
  },
  {
    name: "SaaS Pricing",
    recipe: "nav·hero·prc·faq·cta·ftr",
    spec: [["Navbar", 1], ["Hero", 0], ["Pricing", 0], ["Faq", 0], ["Cta", 0], ["Footer", 0]],
  },
  { name: "Portfolio", recipe: "nav·hero·img·ftr", spec: [["Navbar", 0], ["Hero", 2], ["Gallery", 0], ["Footer", 0]] },
  { name: "Contact", recipe: "nav·hero·form·ftr", spec: [["Navbar", 0], ["Hero", 2], ["Form", 0], ["Footer", 0]] },
  { name: "Blank", recipe: "빈 페이지", spec: [] },
];

/** 부분 추가 시 기본값. */
export const NEW_PARTS: {
  cols: FootCol;
  plans: PlanItem;
  cards: CardItem;
  faqs: TextItem;
  links: TextItem;
  fields: FieldItem;
} = {
  cols: { h: "New", items: ["Link 1", "Link 2"] },
  plans: { tier: "New", price: "₩0", d: "설명을 입력하세요", btn: "선택", featured: false },
  cards: { t: "새 기능", d: "설명을 입력하세요" },
  faqs: { t: "새 질문을 입력하세요" },
  links: { t: "Link" },
  fields: { t: "새 필드", tall: false },
};

/** 섹션 id 생성기 — 스토어가 수명을 소유하고 모델은 주입받는다(순수성). */
export function createIds(start = 1): () => string {
  let n = start;
  return () => "s" + n++;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function makeSection(type: SectionType, variant: number, nextId: () => string): Section {
  const base: Section = { id: nextId(), type, variant: variant || 0, bg: "#ffffff" };
  const per: Partial<Record<SectionType, Partial<Section>>> = {
    Navbar: { title: "Acme", sub: "", btn1: "시작하기", links: [{ t: "Product" }, { t: "Pricing" }, { t: "Docs" }, { t: "Blog" }] },
    Hero: {
      title: "컴포넌트로 조립하는 가장 빠른 방법",
      sub: "템플릿을 고르고, 섹션을 교체하고, AI에게 지시하세요. 코드 없이 페이지가 완성됩니다.",
      badge: "New · v2.0",
      btn1: "무료로 시작",
      btn2: "데모 보기",
    },
    Features: {
      title: "핵심 기능",
      sub: "",
      cards: [
        { t: "빠른 조립", d: "템플릿에서 시작해 몇 분 만에 완성" },
        { t: "부분 교체", d: "섹션 단위로 변형을 바꿔 끼우기" },
        { t: "AI 지시", d: "자연어로 추가·삭제·수정" },
      ],
    },
    Gallery: { title: "갤러리", sub: "" },
    Pricing: {
      title: "요금제",
      sub: "",
      plans: [
        { tier: "Starter", price: "₩0", d: "개인 프로젝트용", btn: "선택", featured: false },
        { tier: "Pro", price: "₩19,000", d: "전문가용 · 무제한 페이지", btn: "선택", featured: true },
        { tier: "Team", price: "₩49,000", d: "팀 협업 · 권한 관리", btn: "선택", featured: false },
      ],
    },
    Testimonial: {
      title: "김지현 · Product Designer",
      sub: "컴포넌트 조합만으로 랜딩페이지를 하루 만에 완성했습니다. 부분 교체 기능이 특히 강력해요.",
      cards: [
        { t: "김지현 · Designer", d: "부분 교체 기능이 특히 강력해요. 랜딩을 하루 만에 완성했습니다." },
        { t: "박민수 · Engineer", d: "코드 없이도 충분히 정교합니다. 팀 온보딩이 쉬워요." },
        { t: "이서연 · PM", d: "AI 지시로 반복 작업이 사라졌습니다." },
      ],
    },
    Stats: {
      title: "숫자로 보는 성과",
      sub: "",
      cards: [
        { t: "120K+", d: "활성 사용자" },
        { t: "99.9%", d: "가동률" },
        { t: "4.9/5", d: "평균 평점" },
        { t: "34개국", d: "서비스 지역" },
      ],
    },
    Logos: {
      title: "이런 팀들이 사용합니다",
      sub: "",
      cards: [
        { t: "Acme", d: "" },
        { t: "Northwind", d: "" },
        { t: "Globex", d: "" },
        { t: "Initech", d: "" },
        { t: "Hooli", d: "" },
      ],
    },
    Team: {
      title: "팀을 소개합니다",
      sub: "",
      cards: [
        { t: "김지현", d: "Product Designer" },
        { t: "박민수", d: "Frontend Engineer" },
        { t: "이서연", d: "Product Manager" },
        { t: "최도윤", d: "Backend Engineer" },
      ],
    },
    Steps: {
      title: "이렇게 시작하세요",
      sub: "",
      cards: [
        { t: "가입", d: "이메일로 30초 만에 시작" },
        { t: "조립", d: "템플릿 선택 후 섹션 교체" },
        { t: "퍼블리시", d: "클릭 한 번으로 배포" },
      ],
    },
    Video: { title: "2분 데모 영상", sub: "" },
    Blog: {
      title: "최신 소식",
      sub: "",
      cards: [
        { t: "v2.0 업데이트", d: "섹션 변형과 AI 지시 기능이 추가되었습니다" },
        { t: "디자인 시스템 연동", d: "토큰 기반 컬러를 적용하는 방법" },
        { t: "고객 사례", d: "하루 만에 랜딩을 완성한 이야기" },
      ],
    },
    Banner: { title: "신규 가입 시 3개월 무료 — 이번 주 마감", sub: "", btn1: "자세히 보기" },
    Breadcrumb: { title: "", sub: "", links: [{ t: "홈" }, { t: "제품" }, { t: "컴포넌트" }, { t: "상세 페이지" }] },
    Table: {
      title: "진행 현황",
      sub: "",
      cards: [
        { t: "온보딩 플로우 리뉴얼", d: "진행중 · 김지현" },
        { t: "가격 페이지 A/B 테스트", d: "검토 · 박민수" },
        { t: "다크 모드 대응", d: "완료 · 이서연" },
      ],
    },
    List: {
      title: "문서",
      sub: "",
      cards: [
        { t: "프로젝트 킥오프 노트", d: "어제 · 문서" },
        { t: "디자인 리뷰 회의록", d: "2일 전 · 문서" },
        { t: "스프린트 백로그", d: "지난주 · 보드" },
      ],
    },
    Form: {
      title: "문의하기",
      sub: "",
      btn1: "보내기",
      fields: [
        { t: "이름", tall: false },
        { t: "이메일", tall: false },
        { t: "메시지", tall: true },
      ],
    },
    Faq: {
      title: "자주 묻는 질문",
      sub: "",
      faqs: [{ t: "코드를 몰라도 사용할 수 있나요?" }, { t: "템플릿의 일부만 바꿀 수 있나요?" }, { t: "내보내기 형식은 무엇인가요?" }],
    },
    Cta: { title: "오늘 바로 시작하세요", sub: "설치 없이 브라우저에서 바로. 무료 플랜 제공.", btn1: "지금 시작하기 →" },
    Footer: {
      title: "Acme",
      sub: "컴포넌트 기반 페이지 빌더",
      copy: "© 2026 Acme. All rights reserved.",
      cols: [
        { h: "Product", items: ["Features", "Pricing", "Changelog"] },
        { h: "Company", items: ["About", "Blog", "Careers"] },
        { h: "Legal", items: ["Privacy", "Terms"] },
      ],
    },
    Divider: { title: "SECTION", sub: "" },
    Diagram: {
      title: "프로세스",
      sub: "",
      code: "flowchart LR\n  A[아이디어] --> B(디자인)\n  B --> C{리뷰}\n  C -->|승인| D[퍼블리시]\n  C -->|수정| B",
    },
    Columns: {
      title: "",
      sub: "",
      cards: [
        { t: "컬럼 제목", d: "내용을 입력하세요. 이 블록은 자유로운 레이아웃 구성을 위한 기본 컬럼입니다." },
        { t: "컬럼 제목", d: "내용을 입력하세요. 컬럼을 추가하거나 삭제할 수 있습니다." },
        { t: "컬럼 제목", d: "3단 변형에서 사용되는 세 번째 컬럼입니다." },
      ],
    },
  };
  return Object.assign(base, clone(per[type] ?? {}));
}

export function buildFromSpec(spec: [SectionType, number][], nextId: () => string): Section[] {
  return spec.map(([type, v]) => {
    const s = makeSection(type, v, nextId);
    s.variant = v;
    return s;
  });
}

export function insertAt(stack: Section[], section: Section, idx: number | null | undefined): Section[] {
  const st = stack.slice();
  const i = idx == null || idx < 0 ? st.length : Math.min(idx, st.length);
  st.splice(i, 0, section);
  return st;
}

/** moveTo — from < idx 면 제거 후 보정(idx-1). */
export function moveTo(stack: Section[], id: string, idx: number | null | undefined): Section[] {
  const st = stack.slice();
  const from = st.findIndex((s) => s.id === id);
  if (from < 0) return stack;
  const [sec] = st.splice(from, 1);
  let i = Math.min(idx == null ? st.length : idx, st.length);
  if (idx != null && from < idx) i = idx - 1;
  st.splice(Math.max(0, i), 0, sec);
  return st;
}

export function removeById(stack: Section[], id: string): Section[] {
  return stack.filter((s) => s.id !== id);
}

export function updateById(stack: Section[], id: string, patch: Partial<Section>): Section[] {
  return stack.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

export function updatePartById(
  stack: Section[],
  id: string,
  listKey: PartListKey,
  idx: number,
  patch: Record<string, unknown>,
): Section[] {
  return stack.map((s) => {
    if (s.id !== id) return s;
    const list = ((s[listKey] as unknown[] | undefined) ?? []).map((it, k) =>
      k === idx ? Object.assign({}, it, patch) : it,
    );
    return { ...s, [listKey]: list };
  });
}

export function addPart(stack: Section[], id: string, listKey: PartListKey): Section[] {
  return stack.map((s) => {
    if (s.id !== id) return s;
    const list = ((s[listKey] as unknown[] | undefined) ?? []).concat([clone(NEW_PARTS[listKey])]);
    return { ...s, [listKey]: list };
  });
}

export function removePart(stack: Section[], id: string, listKey: PartListKey, idx: number): Section[] {
  return stack.map((s) => {
    if (s.id !== id) return s;
    const list = ((s[listKey] as unknown[] | undefined) ?? []).filter((_, k) => k !== idx);
    return { ...s, [listKey]: list };
  });
}

/** 인접 교환 이동 — 범위 밖이면 원본 그대로. */
export function movePart(stack: Section[], id: string, listKey: PartListKey, from: number, to: number): Section[] {
  const sec = stack.find((s) => s.id === id);
  const arr = (sec?.[listKey] as unknown[] | undefined) ?? [];
  if (!sec || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return stack;
  const next = arr.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return stack.map((s) => (s.id === id ? { ...s, [listKey]: next } : s));
}

export function cycleVariant(stack: Section[], id: string): Section[] {
  return stack.map((s) => {
    if (s.id !== id) return s;
    const vs = CATALOG[s.type].variants;
    return { ...s, variant: (s.variant + 1) % vs.length };
  });
}

export function padDefaults(type: SectionType): [number, number] {
  if (type === "Navbar") return [14, 28];
  if (type === "Divider") return [18, 36];
  if (type === "Banner") return [14, 28];
  if (type === "Breadcrumb") return [12, 28];
  if (type === "Hero") return [56, 40];
  return [40, 36];
}

export function darkBg(bg: string): string {
  const map: Record<string, string> = {
    "#ffffff": "#0f172a",
    "#f4f6f8": "#0b1322",
    "#eef2ff": "#151f3d",
    "#faf6ef": "#17182b",
    "#0f172a": "#0f172a",
  };
  return map[bg] || "#0f172a";
}

/** 캔버스 프레임·페이지 셸 팔레트 — 에디터 캔버스와 발행 렌더가 같은 값을 쓴다(단일진실). */
export function shellPalette(pageDark: boolean): {
  canvasBg: string;
  canvasLine: string;
  shellBg: string;
  shellLine: string;
  shellMut: string;
  shellFg: string;
  shellBtnBg: string;
} {
  return pageDark
    ? { canvasBg: "#0b1120", canvasLine: "#26334d", shellBg: "#0d1526", shellLine: "#22304a", shellMut: "#7c8ba6", shellFg: "#e6ecf5", shellBtnBg: "#16203a" }
    : { canvasBg: "#fff", canvasLine: "#d8dfe7", shellBg: "#fbfcfd", shellLine: "#e8edf2", shellMut: "#6b7686", shellFg: "#1b2430", shellBtnBg: "#fff" };
}

export function colorsFor(bg: string, force: boolean): { fg: string; muted: string; line: string; cardBg: string } {
  const dark = force || bg === "#0f172a" || bg === "#1b2430" || bg === "#0b1322" || bg === "#151f3d" || bg === "#17182b";
  return dark
    ? { fg: "#f1f5f9", muted: "#94a3b8", line: "rgba(255,255,255,.16)", cardBg: "rgba(255,255,255,.06)" }
    : { fg: "#1b2430", muted: "#6b7686", line: "#e2e8f0", cardBg: bg === "#ffffff" ? "#fbfcfd" : "#ffffff" };
}

/** 커밋 — 현재 인덱스 뒤 미래 가지를 절단하고 스냅샷을 쌓는다(30개 상한). */
export function pushHistory(
  history: HistoryEntry[],
  historyIdx: number,
  label: string,
  stack: Section[],
): { history: HistoryEntry[]; historyIdx: number } {
  const hist = history.slice(0, historyIdx + 1);
  hist.push({ label, stack: clone(stack) });
  if (hist.length > 30) hist.shift();
  return { history: hist, historyIdx: hist.length - 1 };
}

const AI_TYPE_MAP: [string, SectionType][] = [
  ["히어로", "Hero"],
  ["hero", "Hero"],
  ["내비", "Navbar"],
  ["navbar", "Navbar"],
  ["기능", "Features"],
  ["feature", "Features"],
  ["갤러리", "Gallery"],
  ["gallery", "Gallery"],
  ["가격", "Pricing"],
  ["요금", "Pricing"],
  ["pricing", "Pricing"],
  ["후기", "Testimonial"],
  ["폼", "Form"],
  ["문의", "Form"],
  ["form", "Form"],
  ["faq", "Faq"],
  ["질문", "Faq"],
  ["cta", "Cta"],
  ["배너", "Cta"],
  ["푸터", "Footer"],
  ["footer", "Footer"],
  ["지표", "Stats"],
  ["통계", "Stats"],
  ["로고", "Logos"],
  ["팀", "Team"],
  ["단계", "Steps"],
  ["스텝", "Steps"],
  ["비디오", "Video"],
  ["영상", "Video"],
  ["블로그", "Blog"],
  ["공지", "Banner"],
  ["브레드", "Breadcrumb"],
  ["경로", "Breadcrumb"],
  ["테이블", "Table"],
  ["표 ", "Table"],
  ["리스트", "List"],
  ["목록", "List"],
];

/** 자연어 지시의 해석 규칙만 분리한 순수 파서. */
export function parseAi(instruction: string, stack: Section[]): AiAction {
  const q = String(instruction ?? "").trim();
  if (!q) return { kind: "none" };
  const lower = q.toLowerCase();
  const hit = AI_TYPE_MAP.find(([k]) => lower.includes(k));
  const tpl = TEMPLATES.find((t) => lower.includes(t.name.toLowerCase()));
  if (tpl && (lower.includes("템플릿") || lower.includes("template") || lower.includes("적용")))
    return { kind: "template", name: tpl.name };
  if (hit && (lower.includes("추가") || lower.includes("넣") || lower.includes("add"))) return { kind: "add", type: hit[1] };
  if (hit && (lower.includes("삭제") || lower.includes("지워") || lower.includes("remove")))
    return { kind: "remove", type: hit[1] };
  if (lower.includes("어둡게") || lower.includes("dark")) return { kind: "dark" };
  if (hit && (lower.includes("교체") || lower.includes("변형") || lower.includes("swap"))) return { kind: "swap", type: hit[1] };
  void stack;
  return { kind: "none" };
}
