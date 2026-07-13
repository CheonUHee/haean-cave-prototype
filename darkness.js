// 어둠 체류 패널티 상태 머신 (인쇄쪽 22·47: 2.5/5.5/9s)
export function makeDarkness() { return { t: 0 }; }

// safe = 플레이어가 밝은 칸 | 빛 궤적 | 안전지대에 있는가
export function stepDarkness(d, safe, dt, cfg) {
  d.t = safe ? 0 : d.t + dt;
  if (d.t >= cfg.darkT3) return { stage: 3, speed: cfg.slow2, gameOver: true, t: d.t };
  if (d.t >= cfg.darkT2) return { stage: 2, speed: cfg.slow2, gameOver: false, t: d.t };
  if (d.t >= cfg.darkT1) return { stage: 1, speed: cfg.slow1, gameOver: false, t: d.t };
  return { stage: 0, speed: 1, gameOver: false, t: d.t };
}
