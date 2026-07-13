import { CELL, makeGrid } from './grid.js';
import { traceLight, distToSeg } from './lights.js';

const centerOf = ([c, r], [ox, oy] = [0, 0]) =>
  ({ x: c * CELL + CELL / 2 + ox, y: r * CELL + CELL / 2 + oy });

export function makeWorld(stage, cfg) {
  const w = {
    stage, cfg,
    grid: makeGrid(stage),
    // on: 점등 여부 — 최초 상호작용 전에는 빛을 방출하지 않는다
    source: { ...centerOf(stage.source.cell), dir: stage.source.dir, cell: stage.source.cell,
              on: false },
    // 중간 지점이 없는 스테이지(1단계)는 null
    waypoint: stage.waypoint
      ? { ...centerOf(stage.waypoint.cell), dir: stage.waypoint.dir,
          cell: stage.waypoint.cell, active: false, saved: false, on: false }
      : null,
    goal: { ...centerOf(stage.goal.cell), cell: stage.goal.cell, lit: false, cleared: false },
    stands: stage.stands.map(s => ({ ...s, ...centerOf(s.cell), mirror: null })),
    items: stage.items.map(i => ({ ...i, ...centerOf(i.cell, i.offset), taken: false })),
    triggers: stage.spawnTriggers.map(t => ({ ...t, fired: false })),
    visited: new Set(),      // 도달한 거치대 id — unlessStand 조건 판정용
    shadows: [],
    litCells: new Set(stage.litCells.map(([c, r]) => c + ',' + r)),
    light: { segs: [] },
  };
  retrace(w);
  return w;
}

// 빛 재추적 + 중간지점 활성 갱신 + 목표 점등 갱신
// 광원·중간지점은 점등(on) 후에만 방출. 중간지점은 빛이 닿는 동안만 활성(래치 없음).
// 닿은 빛은 중간지점에서 흡수(통과 불가)되고, 활성+점등 시 자신이 광원이 되어 재방출한다.
// 활성 판정은 자기 방출광을 제외한 1패스로 계산.
export function retrace(w) {
  const sources = w.source.on
    ? [{ x: w.source.x, y: w.source.y, dir: w.source.dir }] : [];
  const mirrors = w.stands.filter(s => s.mirror).map(s => s.mirror);
  const blockers = w.waypoint
    ? [{ x: w.waypoint.x, y: w.waypoint.y, r: w.cfg.lightHalfWidth }] : [];
  const base = traceLight(w.grid, sources, mirrors, w.cfg, blockers);
  if (w.waypoint) w.waypoint.active = base.segs.some(s => s.end === 'waypoint');
  w.light = (w.waypoint && w.waypoint.active && w.waypoint.on)
    ? traceLight(w.grid,
                 [...sources, { x: w.waypoint.x, y: w.waypoint.y, dir: w.waypoint.dir }],
                 mirrors, w.cfg, blockers)
    : base;
  w.goal.lit = w.light.segs.some(s => distToSeg(w.goal.x, w.goal.y, s) <= w.cfg.lightHalfWidth + 1e-9);
}

export function safeZones(w) {
  const z = [{ x: w.source.x, y: w.source.y }];
  if (w.waypoint && w.waypoint.active) z.push({ x: w.waypoint.x, y: w.waypoint.y });
  return z;
}

// 안전지대(그림자 진입 불가·패널티 면제) — 6m×6m 사각형 (인쇄쪽 37)
export function inSafeZone(w, x, y) {
  return safeZones(w).some(z =>
    Math.abs(x - z.x) <= w.cfg.safeHalf && Math.abs(y - z.y) <= w.cfg.safeHalf);
}

// 어둠 패널티에서 안전한가: 안전지대 | 밝은 칸 | 빛 궤적 위(정화)
export function isSafeAt(w, x, y) {
  if (inSafeZone(w, x, y)) return true;
  const [c, r] = w.grid.cellOf(x, y);
  if (w.litCells.has(c + ',' + r)) return true;
  return w.light.segs.some(s => distToSeg(x, y, s) <= w.cfg.lightHalfWidth);
}

// 이벤트에 맞는 미발화 트리거를 발화시키고 반환 (스폰은 호출측에서)
// ev: {type:'reachStand',stand} | {type:'pickupItem',item} | {type:'enterCell',cell:[c,r]}
// unlessStand: 해당 거치대를 이미 방문했으면 발화하지 않음
// group: 같은 그룹 중 하나가 발화하면 나머지도 소진 (같은 스폰 지점 중복 방지)
export function fireTriggers(w, ev) {
  const out = [];
  if (w.cfg.spawnEnabled) {
    for (const t of w.triggers) {
      if (t.fired) continue;
      const hit =
        (t.type === 'reachStand' && ev.type === 'reachStand' && ev.stand === t.stand &&
          (!t.unlessStand || !w.visited.has(t.unlessStand))) ||
        (t.type === 'pickupItem' && ev.type === 'pickupItem' && ev.item === t.item) ||
        (t.type === 'enterCell' && ev.type === 'enterCell' &&
          t.cells.some(([c, r]) => c === ev.cell[0] && r === ev.cell[1]));
      if (hit) { t.fired = true; out.push(t); }
    }
    // 그룹 소진은 루프 뒤에 — 같은 이벤트로 발화하는 그룹 내 트리거들(동시 스폰)을 막지 않는다
    for (const t of out) {
      if (t.group) for (const o of w.triggers) { if (o.group === t.group) o.fired = true; }
    }
  }
  if (ev.type === 'reachStand') w.visited.add(ev.stand);
  return out;
}
