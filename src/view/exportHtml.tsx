// 발행 렌더러 — 스튜디오 문서를 배포 가능한 단일 HTML 로 낸다. 섹션 마크업 소스는 에디터와
// 동일한 SectionView(ExportContext 로 에디터 표면 제거) — 발행/편집 드리프트가 구조적으로 없다.
// 기기 가시성(vis)은 media query 로 싣는다: 발행물은 한 페이지가 두 기기를 다 감당한다.
import { renderToStaticMarkup } from "react-dom/server";
import type { Device, LogoMode, PageLayout, Section } from "@/types";
import type { StudioState } from "@/store";
import { shellPalette } from "@/core/model";
import { FONT_MONO, FONT_SANS } from "@/styles";
import { ExportContext, type ViewApi } from "@/view/common";
import { SectionView } from "@/view/SectionView";
import { LOGO_PRESETS } from "@/view/Canvas";

export interface ExportInput {
  pageName: string;
  stack: Section[];
  layout: PageLayout;
  pageDark: boolean;
  accent: string;
  shellBrand: string;
  logoMode: LogoMode;
  logoIcon: number;
  sideNav: string[];
  /** 사전 렌더된 다이어그램 SVG — 키는 collectDiagrams 가 준 key. */
  mermaidSvg: Record<string, string>;
}

/** 발행 전 사전 렌더가 필요한 다이어그램 수집(Mermaid 캐시 키와 동형). */
export function collectDiagrams(stack: Section[], pageDark: boolean): Array<{ key: string; code: string; dark: boolean }> {
  const out: Array<{ key: string; code: string; dark: boolean }> = [];
  for (const s of stack) {
    if (s.type !== "Diagram") continue;
    const dark = pageDark || s.bg === "#0f172a";
    const code = s.code ?? "";
    out.push({ key: (dark ? "d|" : "l|") + code, code, dark });
  }
  return out;
}

// 발행용 정지 ViewApi — 선택·드래그 없음(SectionView 계약 충족용).
const EXPORT_V: ViewApi = {
  selectedId: null,
  selPart: null,
  selElemKey: null,
  select: () => undefined,
  pickPart: () => undefined,
  selectField: () => undefined,
  selectItem: () => undefined,
  selectColLink: () => undefined,
  clearPart: () => undefined,
  deselect: () => undefined,
  scrollToSection: () => undefined,
  dragPayload: null,
  dropIdx: null,
  setDrag: () => undefined,
  setDropIdx: () => undefined,
  reorderStart: () => undefined,
  reorderOver: () => undefined,
  addAt: null,
  setAddAt: () => undefined,
  addPickerOpen: false,
  setAddPickerOpen: () => undefined,
  mobNavOpen: false,
  mobTocOpen: false,
  setMobNav: () => undefined,
  setMobToc: () => undefined,
};

// 발행용 무동작 스토어 파사드 — SectionView 는 에디터 표면이 제거된 발행 모드에서 이를 호출하지
// 않지만, 계약형(StudioFacade) 충족을 위해 전 메서드를 무동작으로 둔다.
const NOOP_STORE = new Proxy(
  {},
  { get: (_t, prop) => (prop === "get" ? () => ({}) : () => undefined) },
) as never;

function exportState(input: ExportInput): StudioState {
  return {
    pages: [],
    curPage: "export",
    stack: input.stack,
    layout: input.layout,
    history: [],
    historyIdx: 0,
    device: "desktop" as Device,
    pageDark: input.pageDark,
    accent: input.accent,
    shellBrand: input.shellBrand,
    logoMode: input.logoMode,
    logoIcon: input.logoIcon,
    sideNav: input.sideNav,
    sideFixed: false,
    mobBarFixed: false,
    statusMsg: "",
    epoch: 0,
  };
}

function ExportPage({ input }: { input: ExportInput }) {
  const S = exportState(input);
  const pal = shellPalette(input.pageDark);
  const logo = LOGO_PRESETS[input.logoIcon] ?? LOGO_PRESETS[0];
  const showIcon = input.logoMode !== "text";
  const showText = input.logoMode !== "icon";
  const sideL = input.layout === "left" || input.layout === "both";
  const sideR = input.layout === "right" || input.layout === "both";
  const tocItems = input.stack.filter((x) => x.title).slice(0, 8);
  const visClass = (s: Section) => (s.vis === "desktop" ? "vis-desktop" : s.vis === "mobile" ? "vis-mobile" : undefined);

  return (
    <ExportContext.Provider value={{ mermaidSvg: input.mermaidSvg }}>
      <div style={{ minHeight: "100vh", background: pal.canvasBg, display: "flex", alignItems: "stretch" }}>
        {sideL ? (
          <div className="vis-desktop" style={{ width: 190, flex: "none", borderRight: `1px solid ${pal.shellLine}`, background: pal.shellBg }}>
            <div style={{ position: "sticky", top: 0, padding: "18px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 12px" }}>
                {showIcon ? <div style={{ width: 18, height: 18, flex: "none", borderRadius: logo.rad, background: logo.bg(input.accent), transform: logo.tf }} /> : null}
                {showText ? <span style={{ fontWeight: 700, fontSize: 13, color: pal.shellFg }}>{input.shellBrand}</span> : null}
              </div>
              {input.sideNav.map((t, k) => (
                <span
                  key={k}
                  style={{
                    display: "block",
                    padding: "7px 10px",
                    borderRadius: 7,
                    background: k === 0 ? (input.pageDark ? "rgba(255,255,255,.08)" : "#eef2ff") : "transparent",
                    color: k === 0 ? (input.pageDark ? "#9db8e8" : input.accent) : input.pageDark ? "#aeb9cc" : "#4a5568",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {t}
                </span>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 8px 0", borderTop: `1px solid ${pal.shellLine}`, marginTop: 14 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#d3dbe4" }} />
                <span style={{ fontSize: 11, color: pal.shellMut }}>사용자</span>
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ flex: 1, minWidth: 0 }}>
          {input.stack.map((s, i) => (
            <div key={s.id} className={visClass(s)}>
              <SectionView s={s} i={i} S={S} store={NOOP_STORE} V={EXPORT_V} />
            </div>
          ))}
        </div>

        {sideR ? (
          <div className="vis-desktop" style={{ width: 170, flex: "none", borderLeft: `1px solid ${pal.shellLine}`, background: pal.shellBg }}>
            <div style={{ position: "sticky", top: 0, padding: "18px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: "#8a94a3", letterSpacing: ".1em", textTransform: "uppercase" }}>On this page</span>
              {tocItems.map((x) => (
                <span key={x.id} style={{ fontSize: 11.5, color: pal.shellMut, padding: "3px 0", borderLeft: `2px solid ${pal.shellLine}`, paddingLeft: 9 }}>
                  {x.title}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </ExportContext.Provider>
  );
}

/** 문서 전체를 완결 단일 HTML 로. */
export function renderPageHtml(input: ExportInput): string {
  const pal = shellPalette(input.pageDark);
  const body = renderToStaticMarkup(<ExportPage input={input} />);
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return (
    "<!doctype html>\n" +
    '<html lang="ko">\n<head>\n<meta charset="utf-8"/>\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>\n' +
    `<title>${esc(input.pageName)}</title>\n` +
    '<link rel="preconnect" href="https://fonts.googleapis.com"/>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet"/>\n' +
    "<style>\n" +
    "*{box-sizing:border-box}\n" +
    `body{margin:0;font-family:${FONT_SANS};background:${pal.canvasBg};color:${input.pageDark ? "#f1f5f9" : "#1b2430"}}\n` +
    "a{color:#2a6fdb;text-decoration:none}\n" +
    "img{max-width:100%}\n" +
    "@media (max-width: 640px){.vis-desktop{display:none}}\n" +
    "@media (min-width: 641px){.vis-mobile{display:none}}\n" +
    "</style>\n</head>\n<body>" +
    body +
    "</body>\n</html>\n"
  );
}
