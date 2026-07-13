// 스테이지 데이터 검증기 — 에디터 저장·맵 로드·테스트가 공유하는 단일 규칙.
// 반환: { errors: string[], warnings: string[] } — errors가 비어야 플레이 가능 보장.
const DIRS = ['N', 'E', 'S', 'W'];
const HALF = 3;                 // 칸 반폭 m (CELL/2)

export function validateStage(stage) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m);

  if (!stage || typeof stage !== 'object') return { errors: ['스테이지 데이터가 없음'], warnings };
  const cols = stage.cols | 0, rows = stage.rows | 0;
  if (cols < 1 || rows < 1) err(`격자 크기가 잘못됨 (${stage.cols}x${stage.rows})`);

  // ── 바닥 칸 ──
  const cells = Array.isArray(stage.cells) ? stage.cells : [];
  if (cells.length === 0) err('바닥 칸이 없음');
  const key = ([c, r]) => c + ',' + r;
  const floor = new Set();
  for (const cell of cells) {
    const [c, r] = cell;
    if (!Number.isInteger(c) || !Number.isInteger(r) || c < 0 || r < 0 || c >= cols || r >= rows) {
      err(`바닥 칸 (${c},${r})이 격자 범위 밖`);
      continue;
    }
    if (floor.has(key(cell))) err(`바닥 칸 (${c},${r}) 중복`);
    floor.add(key(cell));
  }
  const onFloor = (cell) => Array.isArray(cell) && floor.has(key(cell));

  // ── 필수 오브젝트 ──
  if (!stage.source || !onFloor(stage.source.cell)) err('광원이 없거나 바닥 밖에 있음');
  else if (!DIRS.includes(stage.source.dir)) err(`광원 방향이 잘못됨 (${stage.source.dir})`);
  if (!stage.goal || !onFloor(stage.goal.cell)) err('목표 지점이 없거나 바닥 밖에 있음');
  if (stage.waypoint) {
    if (!onFloor(stage.waypoint.cell)) err('중간 지점이 바닥 밖에 있음');
    else if (!DIRS.includes(stage.waypoint.dir)) err(`중간 지점 방향이 잘못됨 (${stage.waypoint.dir})`);
  }

  // ── 밝은 칸 ──
  for (const cell of stage.litCells || []) {
    if (!onFloor(cell)) err(`밝은 칸 (${cell})이 바닥 밖에 있음`);
  }

  // ── 거치대·유실물·트리거 배치 + id ──
  const stands = stage.stands || [], items = stage.items || [], triggers = stage.spawnTriggers || [];
  const ids = new Set();
  const claim = (id, what) => {
    if (!id) err(`${what}에 id가 없음`);
    else if (ids.has(id)) err(`id 중복: ${id}`);
    ids.add(id);
  };
  const standIds = new Set(stands.map(s => s.id));
  const itemIds = new Set(items.map(i => i.id));

  for (const s of stands) {
    claim(s.id, '거치대');
    if (!onFloor(s.cell)) err(`거치대 ${s.id}가 바닥 밖에 있음`);
  }
  const checkOffset = (id, offset) => {
    if (!offset) return;
    const [ox, oy] = offset;
    if (Math.abs(ox) > HALF - 0.5 || Math.abs(oy) > HALF - 0.5) {
      warnings.push(`${id}의 오프셋 (${ox},${oy})이 칸 안쪽(±${HALF - 0.5}m)을 벗어남`);
    }
  };
  for (const i of items) {
    claim(i.id, '유실물');
    if (!onFloor(i.cell)) err(`유실물 ${i.id}가 바닥 밖에 있음`);
    checkOffset(i.id, i.offset);
  }
  for (const t of triggers) {
    claim(t.id, '트리거');
    if (!onFloor(t.spawnCell)) err(`트리거 ${t.id}의 스폰 칸이 바닥 밖에 있음`);
    checkOffset(t.id, t.spawnOffset);
    if (t.type === 'pickupItem') {
      if (!itemIds.has(t.item)) err(`트리거 ${t.id}가 없는 유실물을 참조: ${t.item}`);
    } else if (t.type === 'reachStand') {
      if (!standIds.has(t.stand)) err(`트리거 ${t.id}가 없는 거치대를 참조: ${t.stand}`);
    } else if (t.type === 'enterCell') {
      if (!Array.isArray(t.cells) || t.cells.length === 0) err(`트리거 ${t.id}의 진입 칸이 비어 있음`);
      else for (const cell of t.cells) { if (!onFloor(cell)) err(`트리거 ${t.id}의 진입 칸 (${cell})이 바닥 밖`); }
    } else {
      err(`트리거 ${t.id}의 종류가 잘못됨: ${t.type}`);
    }
    if (t.unlessStand && !standIds.has(t.unlessStand)) {
      err(`트리거 ${t.id}의 unlessStand가 없는 거치대를 참조: ${t.unlessStand}`);
    }
  }

  // ── BFS 도달성 (광원 기준) ──
  if (stage.source && onFloor(stage.source.cell) && floor.size > 0) {
    const seen = new Set();
    const q = [stage.source.cell];
    while (q.length) {
      const [c, r] = q.pop();
      const k = c + ',' + r;
      if (seen.has(k) || !floor.has(k)) continue;
      seen.add(k);
      q.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
    if (seen.size !== floor.size) {
      err(`광원에서 도달 불가능한 바닥 칸이 ${floor.size - seen.size}개 있음`);
    }
  }

  return { errors, warnings };
}
