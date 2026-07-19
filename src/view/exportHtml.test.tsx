// 발행 렌더러 계약 — 스튜디오 문서 → 배포 가능한 단일 HTML. 에디터 표면(contenteditable·
// data-node·draggable·드롭존)이 없어야 하고, 콘텐츠·다크·레이아웃·다이어그램·기기 가시성이
// 페이지에 실린다. 마크업 소스는 에디터와 동일(SectionView) — 드리프트 금지의 증거.
import { describe, it, expect } from "vitest";
import { buildFromSpec, createIds, makeSection, TEMPLATES, updateById } from "@/core/model";
import { collectDiagrams, renderPageHtml } from "@/view/exportHtml";
import type { Section } from "@/types";

function landing(): Section[] {
  return buildFromSpec(TEMPLATES[0].spec, createIds());
}

const base = {
  pageName: "test-page",
  layout: "stack" as const,
  pageDark: false,
  accent: "#2a6fdb",
  shellBrand: "Acme",
  logoMode: "both" as const,
  logoIcon: 0,
  sideNav: ["대시보드", "프로젝트"],
  mermaidSvg: {},
};

describe("renderPageHtml", () => {
  it("완결 HTML 문서 — 콘텐츠 포함, 에디터 표면 부재", () => {
    const html = renderPageHtml({ ...base, stack: landing() });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>test-page</title>");
    expect(html).toContain("컴포넌트로 조립하는 가장 빠른 방법"); // Hero 제목
    expect(html).toContain("핵심 기능"); // Features
    expect(html).not.toContain("contenteditable");
    expect(html).not.toContain("data-node");
    expect(html).not.toContain('draggable="true"');
    expect(html).not.toContain("cs-dropPulse"); // 드롭존 애니메이션 흔적 없음
  });

  it("다크 모드 — 페이지 배경·셸 팔레트 반영", () => {
    const html = renderPageHtml({ ...base, stack: landing(), pageDark: true });
    expect(html).toContain("background:#0b1120");
    expect(html).toContain("#0f172a"); // darkBg 매핑된 섹션 배경
  });

  it("좌측 사이드바 레이아웃 — 셸 내비·브랜드 렌더", () => {
    const html = renderPageHtml({ ...base, stack: landing(), layout: "left" });
    expect(html).toContain("대시보드");
    expect(html).toContain("Acme");
  });

  it("기기 가시성 — media query 로 숨김(섹션은 항상 마크업에 존재)", () => {
    let st = landing();
    st = updateById(st, st[1].id, { vis: "desktop" });
    st = updateById(st, st[2].id, { vis: "mobile" });
    const html = renderPageHtml({ ...base, stack: st });
    expect(html).toContain('class="vis-desktop"');
    expect(html).toContain('class="vis-mobile"');
    expect(html).toContain("@media (max-width: 640px){.vis-desktop{display:none}}");
    expect(html).toContain("@media (min-width: 641px){.vis-mobile{display:none}}");
  });

  it("다이어그램 — 수집 키와 사전 렌더 SVG 임베드", () => {
    const gen = createIds(100);
    const stack = [makeSection("Diagram", 0, gen)];
    const diagrams = collectDiagrams(stack, false);
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].key.startsWith("l|flowchart LR")).toBe(true);
    const html = renderPageHtml({
      ...base,
      stack,
      mermaidSvg: { [diagrams[0].key]: "<svg data-test-mmd>ok</svg>" },
    });
    expect(html).toContain("<svg data-test-mmd>ok</svg>");
  });
});
