// 코어 모델 계약 테스트 — 문서 연산의 동작 명세.
// RED 먼저: 이 파일이 기대하는 표면이 model.ts 의 단일 진실이다.
import { describe, it, expect } from "vitest";
import {
  CATALOG,
  SECTION_TYPES,
  TEMPLATES,
  NEW_PARTS,
  makeSection,
  buildFromSpec,
  insertAt,
  moveTo,
  removeById,
  updateById,
  updatePartById,
  addPart,
  removePart,
  movePart,
  cycleVariant,
  padDefaults,
  darkBg,
  colorsFor,
  pushHistory,
  parseAi,
  createIds,
} from "@/core/model";
import type { Section } from "@/types";

const ids = () => createIds();

function stackOf(...types: Parameters<typeof makeSection>[0][]): Section[] {
  const gen = ids();
  return types.map((t) => makeSection(t, 0, gen));
}

describe("catalog", () => {
  it("23종 섹션 타입을 전부 싣는다", () => {
    expect(SECTION_TYPES).toHaveLength(23);
    for (const t of SECTION_TYPES) {
      expect(CATALOG[t].variants.length).toBeGreaterThan(0);
      expect(CATALOG[t].ko.length).toBeGreaterThan(0);
      expect(CATALOG[t].glyph.length).toBeGreaterThan(0);
    }
  });

  it("섹션 타입별 변형 수가 카탈로그와 일치한다", () => {
    expect(CATALOG.Hero.variants).toEqual(["센터 정렬", "좌우 분할", "미니멀"]);
    expect(CATALOG.Columns.variants).toHaveLength(4);
    expect(CATALOG.Divider.variants).toEqual(["실선", "여백", "라벨 구분선"]);
    expect(CATALOG.Pricing.variants).toEqual(["3단", "2단"]);
  });
});

describe("templates", () => {
  it("5종 템플릿과 스펙 유효성", () => {
    expect(TEMPLATES.map((t) => t.name)).toEqual(["Landing", "SaaS Pricing", "Portfolio", "Contact", "Blank"]);
    for (const t of TEMPLATES) for (const [type] of t.spec) expect(SECTION_TYPES).toContain(type);
    expect(TEMPLATES.find((t) => t.name === "Blank")!.spec).toEqual([]);
  });

  it("buildFromSpec 은 타입·변형을 그대로 실체화한다", () => {
    const landing = TEMPLATES[0];
    const stack = buildFromSpec(landing.spec, ids());
    expect(stack.map((s) => s.type)).toEqual(["Navbar", "Hero", "Features", "Testimonial", "Cta", "Footer"]);
    expect(stack[1].variant).toBe(1);
    const idSet = new Set(stack.map((s) => s.id));
    expect(idSet.size).toBe(stack.length);
  });
});

describe("makeSection", () => {
  it("타입별 기본 콘텐츠를 채운다", () => {
    const gen = ids();
    const hero = makeSection("Hero", 0, gen);
    expect(hero.bg).toBe("#ffffff");
    expect(hero.badge).toBe("New · v2.0");
    expect(hero.btn1).toBe("무료로 시작");
    const pricing = makeSection("Pricing", 0, gen);
    expect(pricing.plans).toHaveLength(3);
    expect(pricing.plans![1].featured).toBe(true);
    const footer = makeSection("Footer", 0, gen);
    expect(footer.cols!.map((c) => c.h)).toEqual(["Product", "Company", "Legal"]);
    const diagram = makeSection("Diagram", 0, gen);
    expect(diagram.code).toContain("flowchart LR");
  });
});

describe("stack ops", () => {
  it("insertAt: 인덱스 생략은 끝, 범위는 클램프", () => {
    const gen = ids();
    const st = stackOf("Navbar", "Footer");
    const hero = makeSection("Hero", 0, gen);
    expect(insertAt(st, hero, null).map((s) => s.type)).toEqual(["Navbar", "Footer", "Hero"]);
    expect(insertAt(st, hero, 1).map((s) => s.type)).toEqual(["Navbar", "Hero", "Footer"]);
    expect(insertAt(st, hero, 99).map((s) => s.type)).toEqual(["Navbar", "Footer", "Hero"]);
    expect(st).toHaveLength(2); // 원본 불변
  });

  it("moveTo: 아래로 이동 시 인덱스 보정(from < idx → idx-1)", () => {
    const st = stackOf("Navbar", "Hero", "Features", "Footer");
    const heroId = st[1].id;
    expect(moveTo(st, heroId, 3).map((s) => s.type)).toEqual(["Navbar", "Features", "Hero", "Footer"]);
    expect(moveTo(st, heroId, 0).map((s) => s.type)).toEqual(["Hero", "Navbar", "Features", "Footer"]);
    expect(moveTo(st, "없는id", 0)).toBe(st);
  });

  it("removeById / updateById / cycleVariant", () => {
    const st = stackOf("Navbar", "Hero");
    expect(removeById(st, st[0].id).map((s) => s.type)).toEqual(["Hero"]);
    const up = updateById(st, st[1].id, { title: "바뀜" });
    expect(up[1].title).toBe("바뀜");
    expect(st[1].title).not.toBe("바뀜");
    const heroVs = CATALOG.Hero.variants.length;
    let cur = st;
    for (let i = 1; i <= heroVs; i++) {
      cur = cycleVariant(cur, st[1].id);
      expect(cur[1].variant).toBe(i % heroVs);
    }
  });

  it("part ops: update/add/remove/move", () => {
    const st = stackOf("Pricing");
    const id = st[0].id;
    const up = updatePartById(st, id, "plans", 0, { tier: "Free" });
    expect(up[0].plans![0].tier).toBe("Free");
    const added = addPart(st, id, "plans");
    expect(added[0].plans).toHaveLength(4);
    expect(added[0].plans![3].tier).toBe(NEW_PARTS.plans.tier);
    const removed = removePart(st, id, "plans", 1);
    expect(removed[0].plans!.map((p) => p.tier)).toEqual(["Starter", "Team"]);
    const moved = movePart(st, id, "plans", 0, 1);
    expect(moved[0].plans!.map((p) => p.tier)).toEqual(["Pro", "Starter", "Team"]);
    expect(movePart(st, id, "plans", 0, -1)).toBe(st); // 범위 밖 무동작
  });
});

describe("pad/color helpers", () => {
  it("padDefaults 는 타입별 기본값", () => {
    expect(padDefaults("Navbar")).toEqual([14, 28]);
    expect(padDefaults("Hero")).toEqual([56, 40]);
    expect(padDefaults("Features")).toEqual([40, 36]);
  });

  it("darkBg 매핑과 colorsFor 대비", () => {
    expect(darkBg("#ffffff")).toBe("#0f172a");
    expect(darkBg("#eef2ff")).toBe("#151f3d");
    expect(darkBg("#뭔가다른색")).toBe("#0f172a");
    expect(colorsFor("#0f172a", false).fg).toBe("#f1f5f9");
    expect(colorsFor("#ffffff", false).fg).toBe("#1b2430");
    expect(colorsFor("#ffffff", true).fg).toBe("#f1f5f9"); // 강제 다크
    expect(colorsFor("#ffffff", false).cardBg).toBe("#fbfcfd");
    expect(colorsFor("#f4f6f8", false).cardBg).toBe("#ffffff");
  });
});

describe("history", () => {
  it("pushHistory: 미래 가지 절단 + 30개 상한", () => {
    let hist = [{ label: "초기", stack: [] as Section[] }];
    let idx = 0;
    for (let i = 1; i <= 40; i++) {
      const r = pushHistory(hist, idx, "변경 " + i, []);
      hist = r.history;
      idx = r.historyIdx;
    }
    expect(hist.length).toBe(30);
    expect(idx).toBe(29);
    expect(hist[29].label).toBe("변경 40");
    // undo 후 커밋하면 미래 가지가 잘린다
    const r2 = pushHistory(hist, 10, "분기", []);
    expect(r2.history.length).toBe(12);
    expect(r2.history[11].label).toBe("분기");
    expect(r2.historyIdx).toBe(11);
  });

  it("스냅샷은 깊은 복사다", () => {
    const st = stackOf("Hero");
    const { history } = pushHistory([], -1, "초기", st);
    st[0].title = "오염";
    expect(history[0].stack[0].title).not.toBe("오염");
  });
});

describe("parseAi — 자연어 지시 해석 규칙", () => {
  const st = stackOf("Navbar", "Hero", "Pricing");

  it("템플릿 적용", () => {
    expect(parseAi("템플릿 SaaS Pricing 적용", st)).toEqual({ kind: "template", name: "SaaS Pricing" });
    expect(parseAi("landing 템플릿으로 바꿔 적용", st)).toEqual({ kind: "template", name: "Landing" });
  });

  it("추가/삭제/교체/어둡게", () => {
    expect(parseAi("히어로 추가", st)).toEqual({ kind: "add", type: "Hero" });
    expect(parseAi("add faq", st)).toEqual({ kind: "add", type: "Faq" });
    expect(parseAi("가격표 삭제", st)).toEqual({ kind: "remove", type: "Pricing" });
    expect(parseAi("배경 어둡게", st)).toEqual({ kind: "dark" });
    expect(parseAi("히어로 변형 교체", st)).toEqual({ kind: "swap", type: "Hero" });
  });

  it("해석 불가는 none", () => {
    expect(parseAi("아무말이나", st)).toEqual({ kind: "none" });
    expect(parseAi("", st)).toEqual({ kind: "none" });
  });
});
