// soksak-plugin-design-studio 번들 빌드 — esbuild 단일 ESM main.js(loader 가 blob-URL 로 import).
// 디자인은 인라인 스타일 + 소스 문자열 전역 CSS(src/styles.ts)를 Shadow DOM <style> 로 주입.
// mermaid 는 다이어그램 섹션 렌더용으로 번들에 포함한다(sandbox 는 외부 네트워크 불가).
import { build, context } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(root, "src");

const opts = {
  entryPoints: ["src/plugin-entry.tsx"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  alias: { "@": SRC },
  define: {
    "process.env.NODE_ENV": '"production"',
    "import.meta.env.DEV": "false",
  },
  outfile: "main.js",
  minify: true, // mermaid 포함 번들 — 크기 때문에 상시 minify
  legalComments: "none",
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await context(opts);
  await ctx.watch();
  console.log("[studio] watching src → main.js …");
} else {
  await build(opts);
  console.log("[studio] built main.js");
}
