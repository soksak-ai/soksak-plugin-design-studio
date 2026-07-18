// 전역 CSS — Shadow DOM <style> 로 주입(코어 chrome 오염 0).
// 폰트는 로드하지 않고 스택 폴백만 선언한다(sandbox 는 외부 네트워크 불가).
export const FONT_SANS = "'IBM Plex Sans', -apple-system, 'Apple SD Gothic Neo', system-ui, sans-serif";
export const FONT_MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export const GLOBAL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.cs-root {
  font-family: ${FONT_SANS};
  background: #eef1f4;
  color: #1b2430;
  -webkit-font-smoothing: antialiased;
}
.cs-root a { color: #2a6fdb; text-decoration: none; }
.cs-root a:hover { color: #1d54ab; }
.cs-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.cs-root ::-webkit-scrollbar-thumb { background: #c7cfd8; border-radius: 4px; }
.cs-root ::-webkit-scrollbar-track { background: transparent; }
.cs-root input:focus, .cs-root textarea:focus { outline: none; border-color: #2a6fdb; }
.cs-root input, .cs-root textarea, .cs-root button { font-family: ${FONT_SANS}; }
.cs-root [contenteditable]:focus { outline: none; }
@keyframes cs-dropPulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
@keyframes cs-drawerL { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes cs-drawerR { from { transform: translateX(100%); } to { transform: translateX(0); } }
/* hover 표면 CSS 클래스 */
.hov-bg:hover { background: #f2f5f8 !important; }
.hov-line:hover { border-color: #b9c6d6 !important; }
.hov-lib:hover { border-color: #b9c6d6 !important; background: #f7fafc !important; box-shadow: 0 2px 6px rgba(20,30,45,.06); }
.hov-tpl:hover { border-color: #b9c6d6 !important; box-shadow: 0 2px 8px rgba(20,30,45,.08); }
.hov-dash:hover { border-color: #8a94a3 !important; color: #1b2430 !important; }
.hov-white22:hover { background: rgba(255,255,255,.22) !important; }
.hov-accent:hover { border-color: var(--cs-accent) !important; }
.hov-treerow:hover { background: #eef1f4 !important; }
`;
