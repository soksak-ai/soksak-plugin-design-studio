# soksak-plugin-design-studio

soksak 컴포넌트 조립형 페이지 빌더. 23종 섹션 카탈로그를 쌓아 랜딩페이지를 만들고, 섹션별
변형 교체·캔버스 인라인 편집·구조 트리로 다듬는다. 헤드리스 우선: 모든 기능이 레지스트리
명령이라 뷰를 열지 않아도 `sok` CLI/MCP 로 문서 전체를 구동한다.

## 표면

- **뷰** `studio`(콘텐츠 배치) — 상단 바(AI 지시 입력, 기기 토글, 페이지 다크 모드,
  undo/redo, 버전 히스토리, 퍼블리시), 좌측 라이브러리(페이지/컴포넌트/템플릿), 캔버스
  (선택 오버레이, 드래그 배치·재정렬, 인라인 편집), 우측 인스펙터(페이지/섹션/항목 속성)
  + 구조 트리.
- **섹션** — Navbar, Hero(3), Features(2), Gallery, Pricing(2), Testimonial(2), Form, Faq,
  Cta(2), Footer, Columns(4), Diagram(Mermaid), Divider(3), Stats(2), Logos, Team, Steps,
  Video, Blog, Banner, Breadcrumb, Table, List — 괄호는 변형 수.
- **템플릿** — Landing, SaaS Pricing, Portfolio, Contact, Blank. 적용은 현재 페이지 스택을
  교체한다(undo 가능).
- **자연어 지시**(`ai`) — 추가/삭제/교체/어둡게/템플릿 적용. 예: `히어로 추가`,
  `가격표 삭제`, `배경 어둡게`, `템플릿 SaaS Pricing 적용`.
- **영속** — 문서 전체(페이지·스택·설정)를 `data.kv` 한 행(`ns=soksak-plugin-design-studio`,
  `key=doc`)에 커밋마다 기록하고 활성화 시 수화한다. undo 히스토리는 창 세션 상태다.
- **다이어그램** — Diagram 섹션은 진짜 Mermaid 를 번들해 첫 렌더에서 지연 평가한다. 빌드가
  서드파티의 프로토타입 섀도잉 할당(`X.valueOf = …`)을 own 프로퍼티 define 으로 재작성해
  호스트의 동결 `Object.prototype`(tauri `security.freezePrototype`) 아래에서도 동작한다.
- **복원** — 문서는 kv 행으로 재시작을 넘고, 뷰-로컬 상태(선택·패널·라이브러리 탭·검색·
  트리 접힘)는 호스트 복원 seam(`restore.state`/`setRestoreState`)을 탄다 — 복원된 탭이
  떠날 때 그대로 돌아온다. 복원된 선택의 섹션이 더 이상 없으면 해제한다(죽은 참조 부활 금지).
- **발행** — `publish` 명령(상단 바 버튼 동일)이 현재 페이지를 단일 HTML 로 낸다: 에디터와
  같은 섹션 마크업 소스(발행 모드가 편집 표면 제거), 셸 레이아웃, 다크 팔레트, Mermaid SVG
  임베드, `vis` 기기 규칙의 media query 화까지. 기본 경로는 `<프로젝트 루트>/<페이지>.html`.
- **끝까지 구동 가능** — 마우스 없이 모든 표면을 구동한다: `ui.input.fill` 이 인라인
  contenteditable 편집을 확정하고, `ui.input.dnd` 가 섹션 재정렬·라이브러리 드래그 배치
  (노출 드롭존 `dz/*`)·이미지 파일 드롭(노출 슬롯 `img/*`)을 구동한다.
- **라이브 뷰** — 창-realm 로더는 컨트롤러와 뷰를 한 모듈 인스턴스로 돌리므로, 열린 뷰는
  권위 스토어를 직접 구독한다: CLI/MCP 변이가 폴링 0 으로 즉시 화면에 반영된다. 교차 창도
  동일하다: 창마다 `data.kv.watch`(전 창 broadcast)를 구독해 다른 창의 쓰기를 재수화하고,
  자기 쓰기 에코는 창별 writer 스탬프로 걸러지며 외부 변경은 undo 히스토리에 쌓인다.

## 명령

```
sok plugin.soksak-plugin-design-studio.ping
sok plugin.soksak-plugin-design-studio.state
sok plugin.soksak-plugin-design-studio.section.add '{"type":"Hero","variant":1}'
sok plugin.soksak-plugin-design-studio.section.update '{"id":"s1","patch":{"title":"새 제목"}}'
sok plugin.soksak-plugin-design-studio.part.update '{"id":"s3","list":"plans","index":1,"patch":{"price":"₩29,000"}}'
sok plugin.soksak-plugin-design-studio.template.apply '{"name":"SaaS Pricing"}'
sok plugin.soksak-plugin-design-studio.ai '{"instruction":"히어로 추가"}'
sok plugin.soksak-plugin-design-studio.undo
```

전체: `ping`, `state`, `reset`, `page.add/list/open`, `section.add/list/update/remove/move/
swap`, `part.add/update/remove/move`, `template.list/apply`, `ai`, `undo`, `redo`,
`history.list/restore`, `device.set`, `dark.set`, `layout.set`, `accent.set`, `shell.set`, `flags.set`.

## 개발

```
npm install
npm run test-unit   # typecheck + vitest (코어 모델 계약)
npm run build       # esbuild → main.js (단일 ESM 번들, mermaid 포함)
npm run e2e         # 구동 중인 앱 대상 라이브 E2E(멱등, SOKSAK_SOCKET 으로 레인 선택)
sok plugin.dev.load '{"path":"/abs/path/soksak-plugin-design-studio"}'
```
