// 문서 모델 타입 — 단일 진실은 Section 스택(페이지당 하나). 모든 변이는 core/model 의 순수 함수.

export type SectionType =
  | "Navbar"
  | "Hero"
  | "Features"
  | "Gallery"
  | "Pricing"
  | "Testimonial"
  | "Form"
  | "Faq"
  | "Cta"
  | "Footer"
  | "Columns"
  | "Diagram"
  | "Divider"
  | "Stats"
  | "Logos"
  | "Team"
  | "Steps"
  | "Video"
  | "Blog"
  | "Banner"
  | "Breadcrumb"
  | "Table"
  | "List";

export type Visibility = "all" | "desktop" | "mobile";
export type Device = "desktop" | "mobile";
export type PageLayout = "stack" | "left" | "right" | "both";
export type LogoMode = "text" | "icon" | "both";

export interface CardItem {
  t: string;
  d: string;
}
export interface PlanItem {
  tier: string;
  price: string;
  d: string;
  btn: string;
  featured: boolean;
}
export interface TextItem {
  t: string;
}
export interface FieldItem {
  t: string;
  tall: boolean;
}
export interface FootCol {
  h: string;
  items: string[];
}

/** 부분(part) 편집이 가능한 리스트 키. */
export type PartListKey = "links" | "cards" | "plans" | "faqs" | "fields" | "cols";

export interface Section {
  id: string;
  type: SectionType;
  variant: number;
  bg: string;
  title?: string;
  sub?: string;
  badge?: string;
  btn1?: string;
  btn2?: string;
  copy?: string;
  code?: string;
  links?: TextItem[];
  cards?: CardItem[];
  plans?: PlanItem[];
  faqs?: TextItem[];
  fields?: FieldItem[];
  cols?: FootCol[];
  /** 표시 기기 — 생략은 all. */
  vis?: Visibility;
  padY?: number;
  padX?: number;
  padYM?: number;
  padXM?: number;
  /** image-slot 별 저장 이미지(dataURL). 키는 슬롯 suffix. */
  images?: Record<string, string>;
}

export interface PageMeta {
  id: string;
  name: string;
}

export interface HistoryEntry {
  label: string;
  stack: Section[];
}

export interface CatalogEntry {
  ko: string;
  glyph: string;
  variants: string[];
}

export interface TemplateSpec {
  name: string;
  recipe: string;
  spec: [SectionType, number][];
}

/** AI 지시 파싱 결과 — 적용은 스토어가 한다(파서는 순수). */
export type AiAction =
  | { kind: "template"; name: string }
  | { kind: "add"; type: SectionType }
  | { kind: "remove"; type: SectionType }
  | { kind: "dark" }
  | { kind: "swap"; type: SectionType }
  | { kind: "none" };
