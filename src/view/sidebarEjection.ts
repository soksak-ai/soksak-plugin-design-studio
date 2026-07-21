/**
 * Studio 본문과 rail의 소유권 계약.
 *
 * rail 컨테이너가 없는 것은 "옛 인라인 사이드바를 복원"하라는 신호가 아니다.
 * 해당 rail이 현재 다른 콘텐츠에 결부됐거나 호스트가 rail을 지원하지 않는 상태일
 * 뿐이므로, studio 본문은 언제나 canvas-only를 유지한다.
 */
export function sidebarEjectionPlan(input: {
  libraryRail: boolean;
  inspectorRail: boolean;
}) {
  return {
    library: input.libraryRail ? ("rail" as const) : ("absent" as const),
    inspector: input.inspectorRail ? ("rail" as const) : ("absent" as const),
  };
}

/** rail 외곽 경계는 호스트 프레임이 단독 소유한다. */
export function railPanelBorderRightWidth(input: { fill: boolean }): 0 | 1 {
  return input.fill ? 0 : 1;
}
