// soksak-plugin-design-studio 번들 빌드 — esbuild 단일 ESM main.js(loader 가 blob-URL 로 import).
// 디자인은 인라인 스타일 + 소스 문자열 전역 CSS(src/styles.ts)를 Shadow DOM <style> 로 주입.
// mermaid 는 다이어그램 섹션 렌더용으로 번들에 포함한다(sandbox 는 외부 네트워크 불가).
import { build, context } from "esbuild";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const pkgVersion = createRequire(import.meta.url)("./package.json").version;
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(root, "src");

// freezePrototype 호환 — 호스트 앱은 webview 의 Object.prototype 을 동결한다(tauri
// security.freezePrototype, 프로토타입 오염 방어). strict 모드에서 `X.valueOf = f` 같은
// 섀도잉 "할당"은 동결된 상속 프로퍼티의 writable 을 따라 TypeError 로 죽는다(dayjs·
// d3-format·js-yaml 등 관용구). LHS 만 어휘 치환해 own writable 프로퍼티를 먼저 만들면
// 할당이 own 에 안착한다 — RHS 파싱 불요, 라이브러리 의미 불변.
const OBJ_PROTO_NAMES = "valueOf|toString|toLocaleString|hasOwnProperty|isPrototypeOf|propertyIsEnumerable|constructor";
const SHADOW_RE = new RegExp(
  String.raw`([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.(${OBJ_PROTO_NAMES})\s*=(?![=>])`,
  "g",
);
const frozenProtoCompat = {
  name: "frozen-proto-compat",
  setup(b) {
    b.onLoad({ filter: /node_modules\/.*\.(js|mjs|cjs)$/ }, async (args) => {
      const src = await readFile(args.path, "utf8");
      if (!SHADOW_RE.test(src)) return null;
      SHADOW_RE.lastIndex = 0;
      const contents = src.replace(
        SHADOW_RE,
        (_m, lhs, name) =>
          `(Object.defineProperty(${lhs},"${name}",{writable:true,configurable:true,value:undefined}),${lhs}).${name} =`,
      );
      return { contents, loader: "js" };
    });
  },
};

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
    __PLUGIN_VERSION__: JSON.stringify(pkgVersion),
  },
  outfile: "main.js",
  minify: true, // mermaid 포함 번들 — 크기 때문에 상시 minify
  legalComments: "none",
  logLevel: "info",
  plugins: [frozenProtoCompat],
};

// 시각 검증 하니스 — 같은 뷰를 브라우저 단독 페이지로(minify 끔: 스택 판독).
const harnessOpts = {
  ...opts,
  entryPoints: ["src/harness.tsx"],
  outfile: "harness/harness.js",
  minify: false,
};

if (process.argv.includes("--watch")) {
  const ctx = await context(opts);
  await ctx.watch();
  console.log("[studio] watching src → main.js …");
} else {
  await build(opts);
  await build(harnessOpts);
  console.log("[studio] built main.js + harness/harness.js");
}
