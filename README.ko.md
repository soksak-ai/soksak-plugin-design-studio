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
- **영속** — 페이지·설정은 `app.data` 컬렉션(`pages`, `settings`)에 저장하고 다른 창의
  변경은 `data.watch` 로 재수화한다. undo 히스토리는 창 세션 상태다.

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
swap`, `part.add/update/remove`, `template.list/apply`, `ai`, `undo`, `redo`,
`history.list/restore`, `device.set`, `dark.set`, `layout.set`, `accent.set`.

## 개발

```
npm install
npm run test-unit   # typecheck + vitest (코어 모델 계약)
npm run build       # esbuild → main.js (단일 ESM 번들, mermaid 포함)
sok plugin.dev.load '{"path":"/abs/path/soksak-plugin-design-studio"}'
```
