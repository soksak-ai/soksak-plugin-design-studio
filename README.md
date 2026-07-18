# soksak-plugin-design-studio

Component-composition page builder for soksak. Stack sections from a 23-kind catalog into a
landing page, refine each section by swapping variants, edit text inline on the canvas, and
inspect structure in a layer tree. Headless-first: every capability is a registry command, so
the whole document can be driven from `sok` CLI or MCP without opening the view.

## Surface

- **View** `studio` (content placement) — top bar (AI instruction input, device toggle, page
  dark mode, undo/redo, version history, publish), left library (pages / components /
  templates), canvas (selection overlay, drag-drop insert and reorder, inline editing), right
  inspector (page / section / item properties) with a structure tree.
- **Sections** — Navbar, Hero(3), Features(2), Gallery, Pricing(2), Testimonial(2), Form, Faq,
  Cta(2), Footer, Columns(4), Diagram(Mermaid), Divider(3), Stats(2), Logos, Team, Steps,
  Video, Blog, Banner, Breadcrumb, Table, List — numbers are variant counts.
- **Templates** — Landing, SaaS Pricing, Portfolio, Contact, Blank; applying replaces the
  current page stack (undoable).
- **Natural-language instruction** (`ai`) — add / remove / swap / darken / apply template,
  e.g. `히어로 추가`, `가격표 삭제`, `배경 어둡게`, `템플릿 SaaS Pricing 적용`.
- **Persistence** — the whole document (pages, stacks, settings) lives in one `data.kv` row
  (`ns=soksak-plugin-design-studio`, `key=doc`), written on every commit and hydrated at
  activation. Undo history is per-window session state.
- **Diagrams** — the Diagram section renders real Mermaid, bundled and lazy-evaluated at the
  first render. The build rewrites third-party prototype shadow-assignments (`X.valueOf = …`)
  into own-property defines so the bundle survives the host's frozen `Object.prototype`
  (tauri `security.freezePrototype`).
- **Live view** — the window-realm loader runs controller and view in one module instance, so
  the open view subscribes to the authoritative store directly: every CLI/MCP mutation is
  visible immediately, with zero polling.

## Commands

```
sok plugin.soksak-plugin-design-studio.ping
sok plugin.soksak-plugin-design-studio.state
sok plugin.soksak-plugin-design-studio.section.add '{"type":"Hero","variant":1}'
sok plugin.soksak-plugin-design-studio.section.update '{"id":"s1","patch":{"title":"New title"}}'
sok plugin.soksak-plugin-design-studio.part.update '{"id":"s3","list":"plans","index":1,"patch":{"price":"₩29,000"}}'
sok plugin.soksak-plugin-design-studio.template.apply '{"name":"SaaS Pricing"}'
sok plugin.soksak-plugin-design-studio.ai '{"instruction":"히어로 추가"}'
sok plugin.soksak-plugin-design-studio.undo
```

Full list: `ping`, `state`, `reset`, `page.add/list/open`, `section.add/list/update/remove/
move/swap`, `part.add/update/remove/move`, `template.list/apply`, `ai`, `undo`, `redo`,
`history.list/restore`, `device.set`, `dark.set`, `layout.set`, `accent.set`, `shell.set`, `flags.set`.

## Development

```
npm install
npm run test-unit   # typecheck + vitest (core model contract)
npm run build       # esbuild → main.js (single ESM bundle, mermaid included)
sok plugin.dev.load '{"path":"/abs/path/soksak-plugin-design-studio"}'
```
