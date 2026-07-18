// Mermaid 다이어그램 렌더 — 번들된 mermaid 로 코드→SVG. (테마|코드)별 캐시, 이벤트 구동(폴링 없음).
import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { FONT_MONO, FONT_SANS } from "@/styles";

let currentTheme: string | null = null;
const cache = new Map<string, string>();
let seq = 0;

async function render(code: string, dark: boolean): Promise<string> {
  const theme = dark ? "dark" : "neutral";
  const key = (dark ? "d|" : "l|") + code;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  try {
    if (currentTheme !== theme) {
      mermaid.initialize({ startOnLoad: false, theme: theme as "dark" | "neutral", securityLevel: "loose", fontFamily: FONT_SANS });
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
