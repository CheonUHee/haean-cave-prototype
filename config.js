// 모든 튜닝 수치의 단일 소스. 튜닝 패널(debug.js)이 이 객체를 실시간 수정한다.
// 수치 출처: 기획서 「해안 동굴」 (전체 덱 인쇄쪽 22, 33, 36, 42~47)
// 아래 원값 위에 tuned.js(패널에서 확정한 값)가 덮어써진다 — 파일 끝 참조.
import { TUNED } from './tuned.js';

export const CFG = {
  // 캐릭터 (달리기 평균 속력 m/s — 인쇄쪽 33)
  presets: { '스키아': 3.0, '감정사': 2.67, '사키리': 1.9 },
  preset: '감정사',
  playerRadius: 0.4,
  // 회피: 0.5초 안에 2회 사용 시 그 시점부터 0.5초 쿨타임
  dodgeDist: 2.0, dodgeDur: 0.15, dodgeWindow: 0.5, dodgeCooldown: 0.5,
  // 빛 (인쇄쪽 36) — lightRange는 발광체·거울 각각으로부터의 세그먼트당 최대 거리
  lightRange: 30, lightHalfWidth: 0.6, maxBounces: 16, mirrorHalfLen: 0.6,
  snapDeg: 5,   // 거울 각도 45° 배수 소프트 스냅 허용 오차 (0 = 스냅 없음)
  // 어둠 체류 패널티 (인쇄쪽 22·47)
  darkT1: 2.5, darkT2: 5.5, darkT3: 9.0, slow1: 0.75, slow2: 0.5,
  // 시야(안개) 반경 m — 어둠 단계 0/1/2
  vision0: 9.0, vision1: 6.0, vision2: 3.6,
  // 그림자 (인쇄쪽 42~46)
  shPatrolSpeed: 1.5, shChaseSpeed: 3.0, shDashSpeed: 6.0,
  shSightRange: 4.2, shSightHalfAngle: 45,
  shDashDelay: 1.0, shDashSafeDist: 12, shDashTelegraph: 0.5,
  shDashDur: 2.0, shDashStand: 0.5, shDashCd: 6.0,
  shLightSlow: 0.75, shLightKillTime: 2.0, shRadius: 0.6, shLightHitRadius: 0.8,
  // 그림자 오라 (보랏빛 맥동) — 순찰/추적별 주기(Hz)·밝기(0~1)·범위(본체 반경에 더해지는 m)
  shAuraPatrolHz: 0.4, shAuraChaseHz: 1.4,
  shAuraPatrolAlpha: 0.13, shAuraChaseAlpha: 0.34,
  shAuraPatrolRange: 0.9, shAuraChaseRange: 1.4,
  // 안개 농도 (0 = 어둠 구역도 훤히 보임, 1 = 완전 불투명)
  fogAlpha: 0.87,
  contactRadius: 1.0,
  interactRadius: 1.5,
  safeHalf: 3.0,          // 안전지대 반경 3m = 6m×6m 사각형 (인쇄쪽 37)
  spawnEnabled: true,
  showDebug: true,
};

// 확정 튜닝 값 적용 (tuned.js — 패널 '코드 기본값으로 확정'으로 생성, git으로 공유)
for (const [k, v] of Object.entries(TUNED)) { if (k in CFG) CFG[k] = v; }
