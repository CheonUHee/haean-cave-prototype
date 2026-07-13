// 「해안 동굴」 2단계 실측 맵 — 전체도면.png 픽셀 분석 (tools/extract_map.py)
// 좌표 = (col,row), 0-index. 13열 x 9행. 1칸 = 6m.
export const STAGE2 = {
  cols: 13, rows: 9,
  cells: [
    [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
    [6, 1], [7, 1], [8, 1], [9, 1],
    [6, 2], [9, 2],
    [6, 3], [9, 3], [11, 3],
    [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [8, 4], [9, 4], [10, 4], [11, 4],
    [0, 5], [1, 5], [2, 5], [3, 5], [6, 5], [9, 5], [11, 5],
    [1, 6], [3, 6], [6, 6], [9, 6], [10, 6], [11, 6], [12, 6],
    [1, 7], [2, 7], [3, 7], [6, 7], [9, 7],
    [3, 8], [9, 8],
  ],
  litCells: [[1, 7]],                        // 광원 칸은 밝은 칸(어둠 아님)
  source: { cell: [1, 7], dir: 'E' },
  waypoint: { cell: [6, 1], dir: 'E' },      // 중간 지점 (활성화 시 E로 발광)
  goal: { cell: [9, 8] },
  stands: [
    { id: 'm1', cell: [3, 7] },
    { id: 'm2', cell: [3, 4] },
    { id: 'm3', cell: [6, 4] },
    { id: 'm4', cell: [9, 1] },
    { id: 'm5', cell: [9, 4] },
    { id: 'm6', cell: [9, 6] },
    { id: 'm7', cell: [11, 6] },
    { id: 'lock', cell: [11, 4], fixedAngle: Math.PI / 4 },  // "＼" 고정: E→S 반사
    { id: 'aux1', cell: [1, 5], aux: true },
    { id: 'aux2', cell: [6, 0], aux: true },
  ],
  items: [
    { id: 'gem1', cell: [1, 6] },
    // offset: 칸 중심으로부터 m 단위 오프셋 — ③ 남쪽 세로 빔 라인(칸 중앙)을 피해 어둠 구역에 배치
    { id: 'gem2', cell: [6, 6], offset: [1.8, 0] },
  ],
  spawnTriggers: [
    // 스폰 A (그룹): 보조① 도달 시, 또는 보조① 미방문 상태로 ① 도달 시 — 둘 중 한 번만
    { id: 's1a', type: 'reachStand', stand: 'aux1', group: 'A', spawnCell: [3, 5] },
    { id: 's1b', type: 'reachStand', stand: 'm1', unlessStand: 'aux1', group: 'A', spawnCell: [3, 5] },
    // 스폰도 세로 빔 라인 밖(어둠) — 빔 위 스폰 즉시 소멸 방지.
    // gem2와 같은 편(+x)에 소환해 빔이 갈라놓아도 긴장감 유지
    { id: 's2', type: 'pickupItem', item: 'gem2', spawnCell: [6, 7], spawnOffset: [1.8, 0] },
    { id: 's3', type: 'enterCell', cells: [[9, 0]], spawnCell: [8, 0] },   // ④ 위쪽 구역 진입
  ],
};
