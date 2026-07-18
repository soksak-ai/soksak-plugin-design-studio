// mermaid 11.16 은 package.json 이 가리키는 dist/mermaid.d.ts 를 싣지 않는다(실물 부재).
// 사용하는 표면(initialize/render)만 선언한다.
declare module "mermaid" {
  export interface MermaidRenderResult {
    svg: string;
  }
  const mermaid: {
    initialize(config: Record<string, unknown>): void;
    render(id: string, code: string): Promise<MermaidRenderResult>;
  };
  export default mermaid;
}
