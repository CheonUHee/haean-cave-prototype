import { moveCircle } from './grid.js';

export function makePlayer(x, y) {
  return { x, y, fx: 1, fy: 0, dodge: null, dodgeTimes: [], dodgeCdUntil: 0 };
}

// 회피 발동. 규칙: dodgeWindow(0.5s) 안에 2회 사용하면 그 시점부터 dodgeCooldown(0.5s) 쿨
export function tryDodge(p, t, dirx, diry, cfg) {
  if (p.dodge || t < p.dodgeCdUntil) return false;
  const len = Math.hypot(dirx, diry);
  if (!len) return false;
  p.dodgeTimes = p.dodgeTimes.filter(x => t - x < cfg.dodgeWindow);
  p.dodgeTimes.push(t);
  if (p.dodgeTimes.length >= 2) { p.dodgeCdUntil = t + cfg.dodgeCooldown; p.dodgeTimes = []; }
  p.dodge = { dx: dirx / len, dy: diry / len, left: cfg.dodgeDur };
  p.fx = dirx / len; p.fy = diry / len;
  return true;
}

// slowFactor: 어둠 감속 계수(달리기에만 적용, 회피 미적용 — 스펙 §7)
export function updatePlayer(p, input, dt, grid, slowFactor, cfg) {
  if (p.dodge) {
    const v = cfg.dodgeDist / cfg.dodgeDur;
    const step = Math.min(dt, p.dodge.left);
    [p.x, p.y] = moveCircle(grid, p.x, p.y,
      p.dodge.dx * v * step, p.dodge.dy * v * step, cfg.playerRadius);
    p.dodge.left -= step;
    if (p.dodge.left <= 1e-9) p.dodge = null;
    return;
  }
  const len = Math.hypot(input.x, input.y);
  if (!len) return;
  const sp = cfg.presets[cfg.preset] * slowFactor;
  [p.x, p.y] = moveCircle(grid, p.x, p.y,
    (input.x / len) * sp * dt, (input.y / len) * sp * dt, cfg.playerRadius);
  p.fx = input.x / len; p.fy = input.y / len;
}
