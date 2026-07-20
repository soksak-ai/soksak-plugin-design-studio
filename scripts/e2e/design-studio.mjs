// soksak-plugin-design-studio 라이브 E2E — SOKSAK_SOCKET JSON-RPC 로 전체 표면 검증.
// 실행: 이 폴더가 사는 홈의 앱을 띄우고 `npm run e2e` (dev.load·enable 은 스크립트가 시도 — 멱등).
//   이 폴더는 dev 홈(`~/.soksak-dev/plugins/`)에 있으므로 **dev 빌드**로 돌린다:
//     SOKSAK_SOCKET=$HOME/.soksak-dev/com.soksak.dev.sock npm run e2e
//   다른 홈(debug 등)의 앱으로는 돌리지 않는다 — 코어가 다른 홈 안의 경로를 dev source 로
//   받지 않는다(INVALID_PARAMS). 그 홈에서 확인하려면 발행본을 그 홈에 설치한 뒤 돌린다.
// 검증 축: ① 명령 30종(성공·오류 봉투) ② kv 영속 ③ 노출 노드 ④ UI 실구동(fill·dnd 재정렬·
// 라이브러리 드래그 배치·이미지 파일 드롭) ⑤ 발행물(HTML 구조) ⑥ 스냅샷. 종료 상태는 항상
// Landing·desktop·light·stack 으로 복원한다(멱등).
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLUGIN_ID = "soksak-plugin-design-studio";
const P = `plugin.${PLUGIN_ID}.`;
const SOCKET = process.env.SOKSAK_SOCKET || path.join(os.homedir(), ".soksak", "com.soksak.dev.sock");

let sock;
let rbuf = "";
let nextId = 1;
let WINDOW = null; // 워크스페이스 창 label — main(컨트롤플레인)은 플러그인을 싣지 않는다.
const pending = new Map();

function connect() {
  return new Promise((resolve, reject) => {
    sock = net.connect(SOCKET);
    sock.setEncoding("utf8");
    sock.on("connect", resolve);
    sock.on("error", reject);
    sock.on("data", (chunk) => {
      rbuf += chunk;
      let nl;
      while ((nl = rbuf.indexOf("\n")) >= 0) {
        const line = rbuf.slice(0, nl);
        rbuf = rbuf.slice(nl + 1);
        if (!line.trim()) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        const p = pending.get(msg.id);
        if (p) {
          pending.delete(msg.id);
          p(msg);
        }
      }
    });
  });
}

function rpc(method, params = {}, timeoutMs = 15000) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("timeout: " + method));
    }, timeoutMs);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    const envelope = { id, method, params };
    if (WINDOW) envelope.window = WINDOW;
    sock.write(JSON.stringify(envelope) + "\n");
  });
}

const val = (m) => (m && m.result !== undefined ? m.result : m);
let pass = 0;
let fail = 0;
function ok(cond, msg, detail) {
  if (cond) {
    pass++;
    console.log("  ✓ " + msg);
  } else {
    fail++;
    console.log("  ✗ " + msg, detail !== undefined ? JSON.stringify(detail).slice(0, 300) : "");
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 명령 실행 + ok 여부 단언(성공 기대). data 반환. */
async function cmd(name, params, expectOk = true) {
  const out = val(await rpc(name, params));
  ok(out.ok === expectOk, `${name} ${expectOk ? "성공" : "거부(" + out.code + ")"}`, out);
  return out;
}

// 1x1 파랑 PNG — 이미지 드롭 검증용 고정 픽스처(재현 가능).
const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkKPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function main() {
  console.log("socket:", SOCKET);
  await connect();

  // ── 0) 창 결정 + 자기 적재(멱등) ──────────────────────────────────────────
  const wins = val(await rpc("window.list"));
  WINDOW = (wins.data?.labels ?? []).find((l) => l !== "main") ?? null;
  ok(!!WINDOW, "워크스페이스 창 존재: " + WINDOW);
  await rpc("plugin.dev.load", { path: PLUGIN_DIR });
  const en = val(await rpc("plugin.enable", { id: PLUGIN_ID }));
  ok(en.ok, "plugin.enable", en);

  // ── 1) 기준 상태(멱등 시작) ──────────────────────────────────────────────
  console.log("── 명령 표면");
  await cmd(P + "reset", {});
  await cmd(P + "template.apply", { name: "Landing" });
  await cmd(P + "device.set", { device: "desktop" });
  await cmd(P + "dark.set", { on: false });
  await cmd(P + "layout.set", { layout: "stack" });
  await cmd(P + "accent.set", { color: "#2a6fdb" });
  await cmd(P + "shell.set", { brand: "Acme", logoIcon: 0, logoMode: "both" });
  await cmd(P + "flags.set", { sideFixed: false, mobBarFixed: false });

  const ping = await cmd(P + "ping", {});
  ok(String(ping.data?.message ?? ping.message).includes("정상"), "ping 표준답변");
  const st0 = await cmd(P + "state", {});
  ok(st0.data.sections.length === 6, "Landing 6섹션", st0.data.sections.length);
  const heroId = st0.data.sections.find((s) => s.type === "Hero")?.id;
  const testiId = st0.data.sections.find((s) => s.type === "Testimonial")?.id;

  await cmd(P + "template.list", {});
  await cmd(P + "page.list", {});
  await cmd(P + "section.list", {});
  await cmd(P + "history.list", {});

  // 섹션 수명주기
  const added = await cmd(P + "section.add", { type: "Stats", variant: 1, index: 2 });
  const statsId = added.data.section.id;
  await cmd(P + "section.update", { id: statsId, patch: { title: "E2E 지표" } });
  await cmd(P + "section.move", { id: statsId, index: 4 });
  await cmd(P + "section.swap", { id: statsId });
  await cmd(P + "part.add", { id: statsId, list: "cards" });
  await cmd(P + "part.update", { id: statsId, list: "cards", index: 0, patch: { t: "42" } });
  await cmd(P + "part.move", { id: statsId, list: "cards", from: 0, to: 1 });
  await cmd(P + "part.remove", { id: statsId, list: "cards", index: 0 });
  await cmd(P + "section.remove", { id: statsId });

  // AI·히스토리
  await cmd(P + "ai", { instruction: "갤러리 추가" });
  await cmd(P + "undo", {});
  await cmd(P + "redo", {});
  await cmd(P + "undo", {});

  // 페이지 — 추가·전환·복귀(문서에 잔재 없이: 추가한 페이지는 이후 실행에서 재사용)
  const pages = await cmd(P + "page.list", {});
  const probe = pages.data.pages.find((pg) => pg.name === "e2e-probe");
  if (probe) await cmd(P + "page.open", { page: probe.id });
  else await cmd(P + "page.add", { name: "e2e-probe" });
  await cmd(P + "page.open", { page: st0.data.curPage });

  // 오류 봉투(대표 6종)
  console.log("── 오류 봉투");
  await cmd(P + "section.add", { type: "Nope" }, false);
  await cmd(P + "section.update", { id: heroId, patch: { evil: 1 } }, false);
  await cmd(P + "template.apply", { name: "X" }, false);
  await cmd(P + "accent.set", { color: "red" }, false);
  await cmd(P + "part.move", { id: heroId, list: "plans", from: 0, to: 9 }, false);
  // publish 기본 경로(프로젝트 루트)는 여기서 검증하지 않는다 — E2E 가 대상 프로젝트에
  // 산출물을 남기는 부작용 금지. 발행 검증은 아래 ⑤에서 명시적 tmp 경로로만 한다.

  // ── 2) 영속(kv) ─────────────────────────────────────────────────────────
  console.log("── 영속");
  const kv = val(await rpc("data.kv.get", { ns: PLUGIN_ID, key: "doc" }));
  ok(kv.ok && kv.data?.value && typeof kv.data.value.writer === "string", "kv doc + writer 스탬프");

  // ── 3) 뷰 + 노출 노드 ────────────────────────────────────────────────────
  console.log("── 뷰·노드");
  await rpc("plugin.view.open", { view: `${PLUGIN_ID}.studio`, placement: "content" });
  await sleep(1500);
  const ADDR = `win/${WINDOW}/content/view/${PLUGIN_ID}.studio/node`;
  const tree = val(await rpc("ui.tree"));
  const paths = (tree.data?.nodes ?? []).map((n) => n.address).filter((a) => a.includes(`${PLUGIN_ID}.studio/node/`));
  const kinds = new Set(paths.map((a) => a.split("/node/")[1].split("/")[0]));
  ok(kinds.has("section") && kinds.has("tab") && kinds.has("publish"), "노드 노출(section·tab·publish)", [...kinds]);
  // Assets/components 로 강제(복원 상태 무관 멱등)
  await rpc("ui.input.click", { address: `${ADDR}/tab/assets` });
  await sleep(300);
  await rpc("ui.input.click", { address: `${ADDR}/group/components` });
  await sleep(500);

  // ── 4) UI 실구동 ────────────────────────────────────────────────────────
  console.log("── UI 실구동");
  const f = val(await rpc("ui.input.fill", { address: `${ADDR}/edit/${heroId}/title`, value: "E2E 인라인 편집" }));
  ok(f.ok, "fill(contenteditable)", f);
  await sleep(400);
  let st = await cmd(P + "state", {});
  ok(st.data.sections.find((s) => s.id === heroId)?.title === "E2E 인라인 편집", "인라인 편집 확정");

  const dnd1 = val(await rpc("ui.input.dnd", { from: `${ADDR}/section/${heroId}`, to: `${ADDR}/section/${testiId}`, position: "after" }));
  ok(dnd1.ok, "dnd(섹션 재정렬)", dnd1);
  await sleep(500);
  st = await cmd(P + "state", {});
  {
    const order = st.data.sections.map((s) => s.id);
    ok(order.indexOf(heroId) === order.indexOf(testiId) + 1, "재정렬 확정(Hero가 Testimonial 뒤)", order);
  }

  const dnd2 = val(await rpc("ui.input.dnd", { from: `${ADDR}/lib/stats`, to: `${ADDR}/dz/end` }));
  ok(dnd2.ok, "dnd(라이브러리 배치)", dnd2);
  await sleep(500);
  st = await cmd(P + "state", {});
  ok(st.data.sections.at(-1)?.type === "Stats", "라이브러리 드래그로 Stats 추가");

  const imgTarget = `${ADDR}/img/${heroId}/hero`;
  const dnd3 = val(await rpc("ui.input.dnd", { to: imgTarget, files: [{ name: "e2e.png", type: "image/png", base64: PNG_1PX }] }));
  ok(dnd3.ok, "dnd(이미지 파일 드롭)", dnd3);
  await sleep(600);
  st = await cmd(P + "state", {});
  ok(st.data.statusMsg === "이미지 추가", "이미지 드롭 확정", st.data.statusMsg);

  // ── 5) 발행물 ───────────────────────────────────────────────────────────
  console.log("── 발행");
  const outPath = path.join(os.tmpdir(), "design-studio-e2e-publish.html");
  const pub = await cmd(P + "publish", { path: outPath });
  ok(pub.data?.path === outPath, "발행 경로", pub.data);
  const html = fs.readFileSync(outPath, "utf8");
  ok(html.startsWith("<!doctype html>"), "발행물 doctype");
  ok(html.includes("E2E 인라인 편집"), "발행물에 편집 반영");
  ok(!html.includes("contenteditable") && !html.includes("data-node"), "발행물에 편집 표면 없음");
  fs.unlinkSync(outPath);

  // ── 6) 스냅샷(픽셀 증거 산출) ────────────────────────────────────────────
  const shot = path.join(os.tmpdir(), "design-studio-e2e.png");
  const snap = val(await rpc("window.snapshot", { path: shot }));
  ok(snap.ok && fs.existsSync(shot), "스냅샷 저장: " + shot);

  // ── 7) 멱등 종료 상태 복원 ───────────────────────────────────────────────
  await cmd(P + "template.apply", { name: "Landing" });
  await cmd(P + "device.set", { device: "desktop" });
  await cmd(P + "dark.set", { on: false });
  await cmd(P + "layout.set", { layout: "stack" });

  console.log(`\n결과: PASS=${pass} FAIL=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("E2E 실행 실패:", e.message);
  process.exit(1);
});
