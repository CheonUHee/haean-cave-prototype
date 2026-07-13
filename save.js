import { retrace } from './objects.js';
import { makeShadow } from './shadow.js';

// 저장 시점의 진행 상태 스냅샷 (스펙 §10: 빛 궤적/거울은 유지, 이후 진행분 롤백)
export function snapshot(w, player) {
  return structuredClone({
    player: { x: player.x, y: player.y },
    source: { dir: w.source.dir, on: w.source.on },
    // active는 빛 도달 여부로 매 retrace마다 재계산되는 파생 상태 — saved(세이브 기록)만 보존
    waypoint: w.waypoint
      ? { dir: w.waypoint.dir, saved: w.waypoint.saved, on: w.waypoint.on }
      : null,
    mirrors: w.stands.map(s => (s.mirror ? { angle: s.mirror.angle } : null)),
    items: w.items.map(i => i.taken),
    triggers: w.triggers.map(t => t.fired),
    visited: [...w.visited],
    shadows: w.shadows.filter(sh => !sh.dead).map(sh => ({ x: sh.x, y: sh.y })),
  });
}

export function restore(w, player, snap) {
  const s = structuredClone(snap);
  player.x = s.player.x; player.y = s.player.y;
  player.dodge = null; player.dodgeTimes = []; player.dodgeCdUntil = 0;
  w.source.dir = s.source.dir;
  w.source.on = s.source.on;
  if (w.waypoint && s.waypoint) {
    w.waypoint.dir = s.waypoint.dir;
    w.waypoint.saved = s.waypoint.saved;   // active는 아래 retrace가 재계산
    w.waypoint.on = s.waypoint.on;
  }
  w.stands.forEach((st, i) => {
    st.mirror = s.mirrors[i]
      ? { x: st.x, y: st.y, angle: s.mirrors[i].angle, standId: st.id }
      : null;
  });
  w.items.forEach((it, i) => { it.taken = s.items[i]; });
  w.triggers.forEach((t, i) => { t.fired = s.triggers[i]; });
  w.visited = new Set(s.visited);
  w.shadows = s.shadows.map(({ x, y }) => makeShadow(x, y));
  w.goal.cleared = false;
  retrace(w);
}
