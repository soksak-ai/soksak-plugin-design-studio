// 시각 검증 하니스 — 플러그인 뷰(App)를 로컬 권위 스토어(StudioStore, 영속 미주입)로
// 브라우저에 단독 마운트한다. 호스트의 뷰 프레임 브리지가 열리기 전까지 R3(픽셀 검증)의
// 실행면. URL 쿼리로 캡처 상태를 고정한다: ?template=…&device=mobile&dark=1&layout=left
import { createRoot } from "react-dom/client";
import App from "@/view/App";
import { GLOBAL_CSS } from "@/styles";
import { StudioStore } from "@/store";
import type { PageLayout } from "@/types";

const store = new StudioStore();
void store.init().then(() => {
  const q = new URLSearchParams(location.search);
  const tpl = q.get("template");
  if (tpl) store.templateApply(tpl);
  if (q.get("device") === "mobile") store.setDevice("mobile");
  if (q.get("dark") === "1") store.setDark(true);
  const layout = q.get("layout");
  if (layout === "left" || layout === "right" || layout === "both") store.setLayout(layout as PageLayout);
  const accent = q.get("accent");
  if (accent && /^#[0-9a-fA-F]{6}$/.test(accent)) store.setAccent(accent);
  store.setStatus(tpl ? `템플릿 ${tpl} 적용됨` : "템플릿 Landing 적용됨");
  (globalThis as { __studio?: StudioStore }).__studio = store;

  const style = document.createElement("style");
  style.textContent = GLOBAL_CSS;
  document.head.appendChild(style);
  const root = document.getElementById("root")!;
  createRoot(root).render(<App store={store} />);
});
