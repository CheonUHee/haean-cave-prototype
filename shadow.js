import { moveCircle } from './grid.js';
import { distToSeg } from './lights.js';
import { safeZones, inSafeZone } from './objects.js';

// (tx,ty)를 주면 스폰 시 그쪽(플레이어)을 바라본다 — 등 돌린 채 스폰돼 색적이 늦는 것 방지
export function makeShadow(x, y, tx, ty) {
  let fx = 1, fy = 0;
  if (tx !== undefined) {
    const d = Math.hypot(tx - x, ty - y);
    if (d > 1e-9) { fx = (tx - x) / d; fy = (ty - y) / d; }
  }
  return { x, y, fx, fy, state: 'patrol', detectAt: null, dashCdUntil: 0,
           dash: null, lightT: 0, dieT: 0, wanderT: 0, wx: 0, wy: 0, dead: false };
}

// 가장 가까운 빛 세그먼트에서 멀어지는 단위 벡터 (정화 구역 최단 이탈 방향)
export function lightEscape(segs, x, y) {
  let bd = Infinity, ex = 0, ey = 0;
  for (const s of segs) {
    const vx = s.x2 - s.x1, vy = s.y2 - s.y1;
    const len2 = vx * vx + vy * vy;
    let t = len2 ? ((x - s.x1) * vx + (y - s.y1) * vy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = s.x1 + vx * t, qy = s.y1 + vy * t;
    const d = Math.hypot(x - qx, y - qy);
    if (d < bd) {
      bd = d;
      if (d > 1e-9) { ex = (x - qx) / d; ey = (y - qy) / d; }
      else { const L = Math.hypot(vx, vy) || 1; ex = -vy / L; ey = vx / L; }  // 선 위: 법선으로
    }
  }
  return { d: bd, ex, ey };
}

// 전방 시야 콘 색적 (인쇄쪽 43: 반경 4.2m, 90°). 플레이어가 안전(빛/안전지대)하면 불가
export function seesPlayer(sh, px, py, playerSafe, cfg) {
  if (playerSafe) return false;
  const dx = px - sh.x, dy = py - sh.y;
  const d = Math.hypot(dx, dy);
  if (d > cfg.shSightRange || d < 1e-9) return false;
  const cos = (dx * sh.fx + dy * sh.fy) / d;
  return cos >= Math.cos((cfg.shSightHalfAngle * Math.PI) / 180);
}

// 1틱 갱신. 반환 { contact?:true, died?:true }
// rng: 데모가 시드 고정 난수를 넣어 같은 장면을 재현하게 하는 훅.
// main.js는 넘기지 않으므로 게임은 기존과 동일하게 Math.random을 쓴다.
export function updateShadow(sh, t, dt, w, player, playerSafe, cfg, rng = Math.random) {
  const ev = {};
  if (sh.dead) return ev;

  // ── 빛 피격: 감속 25%, 연속 2초 → 사망 (인쇄쪽 46) ──
  const inLight = w.light.segs.some(s => distToSeg(sh.x, sh.y, s) <= cfg.shLightHitRadius);
  sh.lightT = inLight ? sh.lightT + dt : 0;
  const lightMul = inLight ? cfg.shLightSlow : 1;
  if (sh.state !== 'dying' && sh.lightT >= cfg.shLightKillTime) { sh.state = 'dying'; sh.dieT = 0; }
  if (sh.state === 'dying') {
    sh.dieT += dt;
    if (sh.dieT >= 1) { sh.dead = true; ev.died = true; }
    return ev;
  }

  // ── 상태 전이 (BT — 인쇄쪽 42) ──
  const engaged = ['chase', 'telegraph', 'dash', 'stand'].includes(sh.state);
  if (!engaged && seesPlayer(sh, player.x, player.y, playerSafe, cfg)) {
    sh.state = 'chase'; sh.detectAt = t;
  }
  // 순찰 복귀는 광원/활성 중간지점 안전지대 진입 시에만 (인쇄쪽 42 BT).
  // 빛 궤적 위(정화 구역)는 색적만 차단할 뿐, 진행 중인 추격은 끊지 못한다.
  if (sh.state === 'chase' && inSafeZone(w, player.x, player.y)) {
    sh.state = 'patrol'; sh.detectAt = null;
  }

  // ── 행동별 속도 ──
  let vx = 0, vy = 0;
  if (sh.state === 'chase') {
    const nearSafe = Math.min(...safeZones(w).map(z => Math.hypot(sh.x - z.x, sh.y - z.y)));
    if (inLight) {
      // [추적] 중 정화 구역 피격: 추격은 유지하되 최단 방향으로 구역 이탈.
      // 플레이어가 빔 건너편이면 가로질러(횡단) 이탈 — 빔이 벽이 되어 경계에서
      // 멈추는 일이 없게 한다. 같은 편이면 되돌아 이탈.
      const esc = lightEscape(w.light.segs, sh.x, sh.y);
      const qx = sh.x - esc.ex * esc.d, qy = sh.y - esc.ey * esc.d;   // 최근접 빔 위 점
      const side = (player.x - qx) * esc.ex + (player.y - qy) * esc.ey;
      const sgn = side < -1e-9 ? -1 : 1;
      vx = sgn * esc.ex * cfg.shChaseSpeed; vy = sgn * esc.ey * cfg.shChaseSpeed;
    } else if (t >= sh.dashCdUntil && sh.detectAt !== null &&
        t - sh.detectAt >= cfg.shDashDelay && nearSafe > cfg.shDashSafeDist) {
      // 돌진 예고: 발동 시점의 플레이어 위치 고정, 쿨은 발동 시점 기준 (인쇄쪽 45)
      sh.state = 'telegraph';
      sh.dash = { left: cfg.shDashTelegraph, tx: player.x, ty: player.y };
      sh.dashCdUntil = t + cfg.shDashCd;
    } else {
      const d = Math.hypot(player.x - sh.x, player.y - sh.y) || 1;
      vx = ((player.x - sh.x) / d) * cfg.shChaseSpeed;
      vy = ((player.y - sh.y) / d) * cfg.shChaseSpeed;
    }
  } else if (sh.state === 'telegraph') {
    sh.dash.left -= dt;
    if (sh.dash.left <= 0) {
      const d = Math.hypot(sh.dash.tx - sh.x, sh.dash.ty - sh.y) || 1;
      sh.dash = { left: cfg.shDashDur, dx: (sh.dash.tx - sh.x) / d, dy: (sh.dash.ty - sh.y) / d };
      sh.state = 'dash';
    }
  } else if (sh.state === 'dash') {
    vx = sh.dash.dx * cfg.shDashSpeed; vy = sh.dash.dy * cfg.shDashSpeed;
    sh.dash.left -= dt;
    if (sh.dash.left <= 0) { sh.state = 'stand'; sh.dash = { left: cfg.shDashStand }; }
  } else if (sh.state === 'stand') {
    sh.dash.left -= dt;
    if (sh.dash.left <= 0) {
      sh.dash = null;
      // 돌진 후에도 추격 지속 — 플레이어가 안전지대에 들어가야만 순찰 복귀 (콘 이탈 무관)
      if (inSafeZone(w, player.x, player.y)) { sh.state = 'patrol'; sh.detectAt = null; }
      else { sh.state = 'chase'; sh.detectAt = t; }   // 돌진 게이트(1초 대기)도 재시작
    }
  } else { // patrol: 랜덤 배회 (정화 구역 회피)
    if (inLight) {
      // 정화 구역 안에 갇히면 최단 방향으로 즉시 이탈
      const esc = lightEscape(w.light.segs, sh.x, sh.y);
      sh.wx = esc.ex; sh.wy = esc.ey; sh.wanderT = 0.5;
    } else {
      sh.wanderT -= dt;
      if (sh.wanderT <= 0) {
        const a = rng() * Math.PI * 2;
        sh.wx = Math.cos(a); sh.wy = Math.sin(a);
        sh.wanderT = 2 + rng() * 2;
      }
    }
    vx = sh.wx * cfg.shPatrolSpeed; vy = sh.wy * cfg.shPatrolSpeed;
  }

  // ── 이동 (안전지대 진입 금지 — 인쇄쪽 37 / 순찰은 정화 구역 진입 금지) ──
  if (vx || vy) {
    const [nx, ny] = moveCircle(w.grid, sh.x, sh.y, vx * lightMul * dt, vy * lightMul * dt, cfg.shRadius);
    const intoLight = sh.state === 'patrol' && !inLight &&
      w.light.segs.some(s => distToSeg(nx, ny, s) <= cfg.shLightHitRadius);
    if (!inSafeZone(w, nx, ny) && !intoLight) {
      const d = Math.hypot(vx, vy);
      // 순찰 중 벽에 막혀 의도한 거리만큼 못 가면(정면 충돌·벽 비빔) 방향 재추첨
      if (sh.state === 'patrol' &&
          Math.hypot(nx - sh.x, ny - sh.y) < d * lightMul * dt * 0.7) {
        sh.wanderT = 0;
      }
      sh.fx = vx / d; sh.fy = vy / d;
      sh.x = nx; sh.y = ny;
    } else if (sh.state === 'patrol') {
      sh.wanderT = 0;   // 방향 재추첨
    }
  }

  // ── 접촉 = 게임 오버 (인쇄쪽 41) ──
  if (Math.hypot(player.x - sh.x, player.y - sh.y) <= cfg.contactRadius) ev.contact = true;
  return ev;
}
