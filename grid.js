export const CELL = 6, SUB = 1.2;

export function makeGrid(stage) {
  const walk = new Set(stage.cells.map(([c, r]) => c + ',' + r));
  return {
    cols: stage.cols, rows: stage.rows, walk,
    isWalkableCell(c, r) { return walk.has(c + ',' + r); },
    isWalkable(x, y) { return this.isWalkableCell(Math.floor(x / CELL), Math.floor(y / CELL)); },
    cellOf(x, y) { return [Math.floor(x / CELL), Math.floor(y / CELL)]; },
    center(c, r) { return [c * CELL + CELL / 2, r * CELL + CELL / 2]; },
  };
}

// 반경 rad 원이 걷기 가능 영역 안에 완전히 들어가는가 (중심+8방향 샘플)
export function circleFree(grid, x, y, rad) {
  const k = rad * Math.SQRT1_2;
  const pts = [[x, y], [x - rad, y], [x + rad, y], [x, y - rad], [x, y + rad],
               [x - k, y - k], [x + k, y - k], [x - k, y + k], [x + k, y + k]];
  return pts.every(([px, py]) => grid.isWalkable(px, py));
}

// 축 분리 이동: 막힌 축만 취소 → 벽을 따라 미끄러짐
export function moveCircle(grid, x, y, dx, dy, rad) {
  const nx = circleFree(grid, x + dx, y, rad) ? x + dx : x;
  const ny = circleFree(grid, nx, y + dy, rad) ? y + dy : y;
  return [nx, ny];
}

// Amanatides-Woo DDA: 걷기 가능 셀을 벗어나는 지점까지의 광선 거리(최대 maxDist)
export function rayToWall(grid, ox, oy, dx, dy, maxDist) {
  let [c, r] = grid.cellOf(ox, oy);
  if (!grid.isWalkableCell(c, r)) return 0;
  const stepC = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepR = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const tDX = dx !== 0 ? Math.abs(CELL / dx) : Infinity;
  const tDY = dy !== 0 ? Math.abs(CELL / dy) : Infinity;
  let tMX = dx !== 0 ? ((stepC > 0 ? (c + 1) * CELL : c * CELL) - ox) / dx : Infinity;
  let tMY = dy !== 0 ? ((stepR > 0 ? (r + 1) * CELL : r * CELL) - oy) / dy : Infinity;
  let t = 0;
  while (t < maxDist) {
    if (tMX < tMY) { t = tMX; c += stepC; tMX += tDX; }
    else { t = tMY; r += stepR; tMY += tDY; }
    if (t >= maxDist) break;
    if (!grid.isWalkableCell(c, r)) return t;
  }
  return maxDist;
}
