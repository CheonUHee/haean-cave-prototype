import { rayToWall } from './grid.js';

export const DIRV = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

// 거울 상태 = 각도 a. u=(cos a, sin a) 거울면 방향, n=(-sin a, cos a) 반사면(앞면) 법선.
export function mirrorVectors(angle) {
  return { ux: Math.cos(angle), uy: Math.sin(angle), nx: -Math.sin(angle), ny: Math.cos(angle) };
}

// 광선 vs 거울 선분 교차. 반환 { t, s, x, y } 또는 null(평행 포함)
export function rayVsMirror(ox, oy, dx, dy, m, halfLen) {
  const { ux, uy } = mirrorVectors(m.angle);
  const cross = dx * uy - dy * ux;
  if (Math.abs(cross) < 1e-9) return null;
  const wx = m.x - ox, wy = m.y - oy;
  const t = (wx * uy - wy * ux) / cross;
  const s = (wx * dy - wy * dx) / cross;
  if (t < 1e-6 || Math.abs(s) > halfLen) return null;
  return { t, s, x: ox + dx * t, y: oy + dy * t };
}

// 광선 vs 원형 블로커(중간 지점 등). 진입 거리 t 또는 null.
// 원점이 원 안이면 null — 블로커 자신이 광원일 때 자기 차단 방지.
export function rayVsCircle(ox, oy, dx, dy, b) {
  const fx = ox - b.x, fy = oy - b.y;
  if (fx * fx + fy * fy <= b.r * b.r + 1e-9) return null;
  const tm = -(fx * dx + fy * dy);              // 최근접점까지의 t (d는 단위벡터)
  if (tm < 1e-6) return null;
  const d2 = fx * fx + fy * fy - tm * tm;
  if (d2 > b.r * b.r) return null;
  return tm - Math.sqrt(b.r * b.r - d2);
}

// 빛 전체 추적. sources: [{x,y,dir}], mirrors: 배치된 거울, blockers: [{x,y,r}] 빛을 흡수하는 원.
// 반환 { segs: [{x1,y1,x2,y2,end}] } — end: 'wall'|'range'|'mirror'|'blocked'|'waypoint'
export function traceLight(grid, sources, mirrors, cfg, blockers = []) {
  const segs = [];
  for (const src of sources) {
    let [dx, dy] = DIRV[src.dir];
    let ox = src.x, oy = src.y;
    for (let bounce = 0; bounce <= cfg.maxBounces; bounce++) {
      const wallT = rayToWall(grid, ox, oy, dx, dy, cfg.lightRange);
      let best = null;
      for (const m of mirrors) {
        const hit = rayVsMirror(ox, oy, dx, dy, m, cfg.mirrorHalfLen);
        // 경계 포함(<=): 사거리 30m 끝점에 놓인 거치대 ⑥이 빛을 받는 케이스 (스테이지2 필수)
        if (hit && hit.t <= wallT + 1e-6 && (!best || hit.t < best.t)) best = { ...hit, m };
      }
      let blk = null;
      for (const b of blockers) {
        const t = rayVsCircle(ox, oy, dx, dy, b);
        if (t !== null && t <= wallT + 1e-6 && (!blk || t < blk)) blk = t;
      }
      if (blk !== null && (!best || blk < best.t)) {   // 블로커가 거울보다 가까움 → 흡수
        segs.push({ x1: ox, y1: oy, x2: ox + dx * blk, y2: oy + dy * blk, end: 'waypoint' });
        break;
      }
      if (!best) {
        segs.push({ x1: ox, y1: oy, x2: ox + dx * wallT, y2: oy + dy * wallT,
                    end: wallT >= cfg.lightRange - 1e-9 ? 'range' : 'wall' });
        break;
      }
      const { nx, ny } = mirrorVectors(best.m.angle);
      const dot = dx * nx + dy * ny;
      if (dot > -1e-6) {                          // 뒷면·그레이징 → 차단
        segs.push({ x1: ox, y1: oy, x2: best.x, y2: best.y, end: 'blocked' });
        break;
      }
      segs.push({ x1: ox, y1: oy, x2: best.x, y2: best.y, end: 'mirror' });
      dx = dx - 2 * dot * nx; dy = dy - 2 * dot * ny;
      ox = best.x + dx * 1e-4; oy = best.y + dy * 1e-4;  // 자기 재교차 방지
    }
  }
  return { segs };
}

export function distToSeg(x, y, s) {
  const vx = s.x2 - s.x1, vy = s.y2 - s.y1;
  const len2 = vx * vx + vy * vy;
  let t = len2 ? ((x - s.x1) * vx + (y - s.y1) * vy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (s.x1 + vx * t), y - (s.y1 + vy * t));
}

// 점이 빛 궤적(폭 2*halfWidth) 위에 있는가 — 어둠 정화 판정
export function onLight(segs, x, y, halfWidth) {
  return segs.some(s => distToSeg(x, y, s) <= halfWidth);
}

// 입사광과 수직(입사각 0°)이 되도록 초기 각도: 앞면 법선 = -입사방향
export function perpendicularAngle(dx, dy) {
  return Math.atan2(dx, -dy);   // n=(-sin a, cos a)=(-dx,-dy) 의 해
}
