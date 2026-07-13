// 맵 에디터 코어 — DOM 없는 순수 상태 모델.
// 스테이지 스키마는 maps/stage*.js와 동일하며, 편집 중에는 source/goal이 null일 수 있다
// (저장 시 validateStage가 막는다).

export function newStage(cols, rows) {
  return {
    cols, rows,
    cells: [], litCells: [],
    source: null, waypoint: null, goal: null,
    stands: [], items: [], spawnTriggers: [],
  };
}

const key = (c, r) => c + ',' + r;
const same = (cell, c, r) => cell && cell[0] === c && cell[1] === r;

export function isFloor(stage, c, r) {
  return stage.cells.some(cell => same(cell, c, r));
}

// 바닥 토글. 바닥을 없애면 그 칸의 오브젝트·밝은칸·트리거 진입칸 참조도 정리한다.
export function toggleFloor(stage, c, r) {
  if (isFloor(stage, c, r)) {
    stage.cells = stage.cells.filter(cell => !same(cell, c, r));
    stage.litCells = stage.litCells.filter(cell => !same(cell, c, r));
    removeObjectAt(stage, c, r);
    for (const t of stage.spawnTriggers) {
      if (t.type === 'enterCell') t.cells = t.cells.filter(cell => !same(cell, c, r));
    }
  } else {
    stage.cells.push([c, r]);
  }
}

export function toggleLit(stage, c, r) {
  if (!isFloor(stage, c, r)) return false;
  if (stage.litCells.some(cell => same(cell, c, r))) {
    stage.litCells = stage.litCells.filter(cell => !same(cell, c, r));
  } else {
    stage.litCells.push([c, r]);
  }
  return true;
}

// 그 칸을 차지한 오브젝트 반환: { kind, obj } | null. obj는 라이브 참조(인스펙터가 직접 수정).
export function objectAt(stage, c, r) {
  if (stage.source && same(stage.source.cell, c, r)) return { kind: 'source', obj: stage.source };
  if (stage.waypoint && same(stage.waypoint.cell, c, r)) return { kind: 'waypoint', obj: stage.waypoint };
  if (stage.goal && same(stage.goal.cell, c, r)) return { kind: 'goal', obj: stage.goal };
  for (const s of stage.stands) {
    if (same(s.cell, c, r)) {
      return { kind: s.fixedAngle !== undefined ? 'lock' : s.aux ? 'aux' : 'stand', obj: s };
    }
  }
  for (const i of stage.items) { if (same(i.cell, c, r)) return { kind: 'item', obj: i }; }
  for (const t of stage.spawnTriggers) { if (same(t.spawnCell, c, r)) return { kind: 'spawn', obj: t }; }
  return null;
}

export function removeObjectAt(stage, c, r) {
  const hit = objectAt(stage, c, r);
  if (!hit) return false;
  if (hit.kind === 'source') stage.source = null;
  else if (hit.kind === 'waypoint') stage.waypoint = null;
  else if (hit.kind === 'goal') stage.goal = null;
  else if (hit.kind === 'item') stage.items = stage.items.filter(i => i !== hit.obj);
  else if (hit.kind === 'spawn') stage.spawnTriggers = stage.spawnTriggers.filter(t => t !== hit.obj);
  else stage.stands = stage.stands.filter(s => s !== hit.obj);
  return true;
}

// 접두사별 다음 빈 번호 (m1, m2… — 삭제된 번호는 재사용)
function nextId(existing, prefix) {
  const used = new Set(existing.map(x => x.id));
  for (let n = 1; ; n++) { if (!used.has(prefix + n)) return prefix + n; }
}

// kind: source | waypoint | goal | stand | lock | aux | item | spawn
// 바닥 위에만 배치. 한 칸 = 한 오브젝트(기존 것 교체). 성공 여부 반환.
export function placeObject(stage, kind, c, r) {
  if (!isFloor(stage, c, r)) return false;
  removeObjectAt(stage, c, r);
  if (kind === 'source') {
    stage.source = { cell: [c, r], dir: stage.source ? stage.source.dir : 'E' };
    // 단일: 이전 위치 제거는 위 대입으로 완료 (cell 교체)
  } else if (kind === 'waypoint') {
    stage.waypoint = { cell: [c, r], dir: stage.waypoint ? stage.waypoint.dir : 'E' };
  } else if (kind === 'goal') {
    stage.goal = { cell: [c, r] };
  } else if (kind === 'stand') {
    stage.stands.push({ id: nextId(stage.stands, 'm'), cell: [c, r] });
  } else if (kind === 'aux') {
    stage.stands.push({ id: nextId(stage.stands, 'aux'), cell: [c, r], aux: true });
  } else if (kind === 'lock') {
    // 기본 -π/4 = "／" (N→E / W→S 반사). 인스펙터에서 변경.
    stage.stands.push({ id: nextId(stage.stands, 'lock'), cell: [c, r], fixedAngle: -Math.PI / 4 });
  } else if (kind === 'item') {
    stage.items.push({ id: nextId(stage.items, 'gem'), cell: [c, r] });
  } else if (kind === 'spawn') {
    // 기본 조건: 그 자리 진입 시 스폰 — 항상 유효한 참조. 인스펙터에서 변경.
    stage.spawnTriggers.push({
      id: nextId(stage.spawnTriggers, 't'),
      type: 'enterCell', cells: [[c, r]], spawnCell: [c, r],
    });
  } else {
    return false;
  }
  return true;
}

const byRowMajor = (a, b) => (a[1] - b[1]) || (a[0] - b[0]);

// 저장용 직렬화 — cells/litCells를 행우선 정렬해 diff 안정화
export function serialize(stage) {
  const out = deserialize(stage);
  out.cells.sort(byRowMajor);
  out.litCells.sort(byRowMajor);
  return JSON.stringify(out, null, 2);
}

// JSON 문자열 또는 객체 → 안전 복제 + 누락 필드 기본값
export function deserialize(src) {
  const raw = typeof src === 'string' ? JSON.parse(src) : structuredClone(src);
  return {
    cols: raw.cols | 0, rows: raw.rows | 0,
    cells: (raw.cells || []).map(([c, r]) => [c, r]),
    litCells: (raw.litCells || []).map(([c, r]) => [c, r]),
    source: raw.source ? { cell: [...raw.source.cell], dir: raw.source.dir } : null,
    waypoint: raw.waypoint ? { cell: [...raw.waypoint.cell], dir: raw.waypoint.dir } : null,
    goal: raw.goal ? { cell: [...raw.goal.cell] } : null,
    stands: (raw.stands || []).map(s => ({ ...s, cell: [...s.cell] })),
    items: (raw.items || []).map(i => ({ ...i, cell: [...i.cell] })),
    spawnTriggers: (raw.spawnTriggers || []).map(t => ({
      ...t,
      spawnCell: [...t.spawnCell],
      ...(t.cells ? { cells: t.cells.map(([c, r]) => [c, r]) } : {}),
    })),
  };
}
