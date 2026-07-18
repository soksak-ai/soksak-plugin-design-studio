// Mermaid 다이어그램 렌더 — 번들된 mermaid 로 코드→SVG. (테마|코드)별 캐시, 이벤트 구동(폴링 없음).
import { useEffect, useRef, useState } from "react";
import { FONT_MONO, FONT_SANS } from "@/styles";

// mermaid 는 지연 로드 — 번들엔 포함되지만 첫 Diagram 렌더까지 평가를 미룬다(3MB 파싱 비용을
// 활성화 경로에서 제거). esbuild 단일 번들에서 내부 dynamic import 는 lazy-init 로 변환된다.
type MermaidApi = {
  initialize(config: Record<string, unknown>): void;
  render(id: string, code: string): Promise<{ svg: string }>;
};
let mermaidLoad: Promise<MermaidApi> | null = null;
const loadMermaid = (): Promise<MermaidApi> => (mermaidLoad ??= import("mermaid").then((m) => m.default));

let currentTheme: string | null = null;
const cache = new Map<string, string>();
let seq = 0;

async function render(code: string, dark: boolean): Promise<string> {
  const theme = dark ? "dark" : "neutral";
  const key = (dark ? "d|" : "l|") + code;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  try {
    const mermaid = await loadMermaid();
    if (currentTheme !== theme) {
      mermaid.initialize({ startOnLoad: false, theme, securityLevel: "loose", fontFamily: FONT_SANS });
      currentTheme = theme;
    }
    const r = await mermaid.render("csmmd" + seq++, code);
    cache.set(key, r.svg);
    return r.svg;
  } catch (e) {
    const html =
      '<div style="color:#c05353;font-family:' +
      FONT_MONO.replace(/"/g, "'") +
      ';font-size:11px;padding:12px">Mermaid 오류: ' +
      String((e as Error)?.message ?? e).replace(/</g, "&lt;") +
      "</div>";
    cache.set(key, html);
    return html;
  }
}

export function Mermaid(props: { code: string; dark: boolean }) {
  const [html, setHtml] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void render(props.code, props.dark).then((svg) => {
      if (alive.current) setHtml(svg);
    });
    return () => {
      alive.current = false;
    };
  }, [props.code, props.dark]);
  return (
    <div
      style={{ display: "flex", justifyContent: "center", minHeight: 90, overflow: "auto" }}
      dangerouslySetInnerHTML={{
        __html:
          html ??
          '<div style="font-family:monospace;font-size:11px;color:#8a94a3;padding:24px">다이어그램 렌더링 중…</div>',
      }}
    />
  );
}
