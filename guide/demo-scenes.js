// 신규 데모의 장면 로직 — 맵·타임라인(demo-maps.js)과 배선(demos.js) 사이의 "무엇이 벌어지는가".
// createDemoSim에 그대로 펼쳐 넣을 수 있는 { setup, onFrame } 조각을 만든다.
import { placeMirror } from '../mirrors.js';
import { retrace } from '../objects.js';

// 데모 시뮬의 고정 timestep (demo-sim.js의 DT와 같아야 한다)
const DT = 1 / 60;
// 조준 각속도 기본 한계(rad/s). 사람이 마우스를 돌리는 속도에 한계가 있듯 거울도 즉시 돌지 않는다.
// 값이 크면 사실상 즉시 조준이라 "겨누는 동작"이 화면에 남지 않는다 — 장면마다 지정한다.
const AIM_RATE = 5;

// 입사 방향 (dx,dy)의 빛을 (tx,ty)로 반사시키는 거울 각도를 직접 계산한다.
// 반사 법칙 o = d - 2(d·n)n 을 뒤집으면 법선 n ∝ (o - d)이고,
// 이 프로젝트의 거울은 n = (-sin a, cos a)이므로 a = atan2(-nx, ny)다.
// (rotateMirrorToward는 45° 스냅이 걸려 추적에 쓰기 어렵다)
// rate가 숫자면 프레임당 rate*DT(rad)만큼만 목표 각도에 접근한다(0 또는 false면 즉시 조준).
function aimMirror(stand, dx, dy, tx, ty, rate = 0) {
  const L = Math.hypot(tx - stand.x, ty - stand.y) || 1;
  const ox = (tx - stand.x) / L, oy = (ty - stand.y) / L;
  const nx = ox - dx, ny = oy - dy;
  const nl = Math.hypot(nx, ny);
  if (nl < 1e-9) return;                 // 입사와 목표가 같은 방향 — 반사 불가
  const target = Math.atan2(-(nx / nl), ny / nl);
  if (!rate) { stand.mirror.angle = target; return; }
  // 각도 차를 [-π, π]로 감아 최단 방향으로 회전시킨다
  const diff = Math.atan2(Math.sin(target - stand.mirror.angle),
                          Math.cos(target - stand.mirror.angle));
  const step = rate * DT;
  stand.mirror.angle += Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
}

// 리셋 직후 첫 거치대에 거울을 놓는다. 빛이 닿아 있어야 성공한다.
function placeFirstMirror(w, cfg) {
  const st = w.stands[0];
  if (st && !st.mirror) { placeMirror(st, w.light.segs, cfg); retrace(w); }
}

// 기믹 ①: 거울 각도를 90°(되쏘기) → 135°(북쪽 반사)로 스윕해 목표에 맞아 들어간다.
export function gimmickLightScene() {
  return {
    setup: placeFirstMirror,
    onFrame(t, cfg, w) {
      const st = w.stands[0];
      if (!st || !st.mirror) return;
      const f = Math.min(1, Math.max(0, (t - 0.8) / 2.4));
      st.mirror.angle = Math.PI / 2 + f * (Math.PI / 4);
    },
  };
}

// 기믹 ②·파훼 ④: 살아 있는 그림자를 매 프레임 조준한다. 빛에 닿으면 달아나므로 추적이 필요하다.
// 입사 방향은 광원이 동쪽으로 쏘는 (1,0) 고정이다.
//
// aimRate(rad/s): 사람이 마우스로 거울을 돌리는 속도의 한계. 지정하면 조준이 "겨누는 동작"으로
//   화면에 남고, 달아나는 그림자를 뒤쫓는 지연도 생긴다. 생략하면 즉시 조준이다.
// startAngle: 거울의 시작 각도(rad). 그림자와 다른 쪽을 향하게 두면 겨누는 과정이 보인다.
//   45°면 동쪽에서 온 빛을 남쪽으로 반사한다.
export function trackShadowScene({ aimRate = 0, startAngle = null } = {}) {
  return {
    setup(w, cfg) {
      placeFirstMirror(w, cfg);
      const st = w.stands[0];
      if (startAngle !== null && st && st.mirror) { st.mirror.angle = startAngle; retrace(w); }
    },
    onFrame(t, cfg, w) {
      const st = w.stands[0];
      const sh = w.shadows.find(s => !s.dead);
      if (!st || !st.mirror || !sh) return;
      aimMirror(st, 1, 0, sh.x, sh.y, aimRate);
    },
  };
}

// 기믹 ②는 즉시 조준(짧고 단순한 "빛 = 무기" 시연)
export const gimmickShadowScene = () => trackShadowScene();
