import { distToSeg, perpendicularAngle } from './lights.js';

// 거치대가 현재 빛을 받고 있는가 (거울 배치 조건 — 스펙 §8)
export function standLit(stand, segs, cfg) {
  return segs.some(s => distToSeg(stand.x, stand.y, s) <= cfg.lightHalfWidth + 1e-9);
}

// 거치대에 닿는 빛의 진행 방향 (가장 가까운 세그먼트 기준)
export function incidentDir(stand, segs, cfg) {
  let best = null, bd = Infinity;
  for (const s of segs) {
    const d = distToSeg(stand.x, stand.y, s);
    if (d <= cfg.lightHalfWidth + 1e-9 && d < bd) { bd = d; best = s; }
  }
  if (!best) return null;
  const len = Math.hypot(best.x2 - best.x1, best.y2 - best.y1) || 1;
  return [(best.x2 - best.x1) / len, (best.y2 - best.y1) / len];
}

// 거울 배치. 성공 { mirror }, 실패 { error: 'unlit' | 'already' }
// 초기 각도 = 입사광과 수직(입사각 0°). 고정 거치대는 fixedAngle 사용.
export function placeMirror(stand, segs, cfg) {
  if (stand.mirror) return { error: 'already' };
  if (!standLit(stand, segs, cfg)) return { error: 'unlit' };
  const d = incidentDir(stand, segs, cfg);
  const angle = stand.fixedAngle !== undefined ? stand.fixedAngle
                                               : perpendicularAngle(d[0], d[1]);
  stand.mirror = { x: stand.x, y: stand.y, angle, standId: stand.id };
  return { mirror: stand.mirror };
}

export function canRotate(stand) {
  return !!stand.mirror && stand.fixedAngle === undefined;
}

// 거울 앞면 법선이 월드 좌표 (wx,wy)를 향하도록 회전 (마우스 조작)
// cfg.snapDeg > 0 이면 45° 배수 근처에서 소프트 스냅 — 기획서 "90° 반사 준수" 연결을
// 픽셀 단위 조준 없이 찾을 수 있게 한다 (자유 각도 조준은 유지)
export function rotateMirrorToward(stand, wx, wy, cfg) {
  if (!canRotate(stand)) return false;
  let angle = Math.atan2(-(wx - stand.x), (wy - stand.y));
  const snap = ((cfg && cfg.snapDeg) || 0) * Math.PI / 180;
  if (snap > 0) {
    const q = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    if (Math.abs(angle - q) < snap) angle = q;
  }
  stand.mirror.angle = angle;
  return true;
}
