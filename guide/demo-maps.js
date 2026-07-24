// 데모 맵 + 입력 타임라인. 맵 스키마는 maps/stage*.js와 동일.

// t0→t1 동안 마우스가 (x0,y0)→(x1,y1)로 이동하는 mousemove 이벤트 열.
// steps가 작으면 커서가 뚝뚝 끊겨 보인다 — 32면 약 50ms 간격으로 부드럽다.
function tween(t0, t1, x0, y0, x1, y1, steps = 32) {
  const evs = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    evs.push({ t: t0 + (t1 - t0) * f, type: 'mousemove',
               x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f });
  }
  return evs;
}

// ── 입력별 미니 데모 4종 ──
// 게임 관례대로 litCells는 광원 칸 하나뿐이고 나머지는 어둠이다.
// 캐릭터는 광원 안전지대(중심 ±3m) 안이나 빛 궤적 위(반폭 0.6m)에만 있으므로
// 어둠 패널티가 쌓이지 않는다. 네 맵 모두 3열×2행 → 캔버스 252×168px로 통일.
// 좌표: 1칸 = 6m, 칸 중심 = 칸좌표*6+3. 속력 2.67m/s, 회피 1회 2m.

// ① 이동: 광원 칸(9,3) 안에서만 상하좌우. 안전지대 x6~12 · y0~6을 벗어나지 않는다.
export const DEMO_MOVE = {
  cols: 3, rows: 2,
  cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  litCells: [[1, 0]],
  source: { cell: [1, 0], dir: 'E' },
  waypoint: null,
  goal: { cell: [2, 1] },
  stands: [], items: [], spawnTriggers: [],
};
// 각 구간 2m(0.75초) 또는 4m(1.5초). 끝나면 시작점 (9,3)으로 정확히 복귀한다.
export const MOVE_EVENTS = [
  { t: 0.50, type: 'keydown', key: 'w' },   // y 3 → 1
  { t: 1.25, type: 'keyup', key: 'w' },
  { t: 1.60, type: 'keydown', key: 's' },   // y 1 → 5
  { t: 3.10, type: 'keyup', key: 's' },
  { t: 3.45, type: 'keydown', key: 'w' },   // y 5 → 3 (복귀)
  { t: 4.20, type: 'keyup', key: 'w' },
  { t: 4.55, type: 'keydown', key: 'a' },   // x 9 → 7
  { t: 5.30, type: 'keyup', key: 'a' },
  { t: 5.65, type: 'keydown', key: 'd' },   // x 7 → 11
  { t: 7.15, type: 'keyup', key: 'd' },
  { t: 7.50, type: 'keydown', key: 'a' },   // x 11 → 9 (복귀)
  { t: 8.25, type: 'keyup', key: 'a' },
].sort((a, b) => a.t - b.t);
export const MOVE_DURATION = 9.0;

// ② 회피: 광원(3,3)에서 동쪽으로 뻗은 빔 위를 달리며 회피 3회 시도.
// 0.5초 안에 2회를 쓰면 그 시점부터 0.5초 쿨 — 3회째는 발동하지 않는다.
export const DEMO_DODGE = {
  cols: 3, rows: 2,
  cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  litCells: [[0, 0]],
  source: { cell: [0, 0], dir: 'E' },
  waypoint: null,
  goal: { cell: [2, 1] },
  stands: [], items: [], spawnTriggers: [],
};
export const DODGE_EVENTS = [
  { t: 0.50, type: 'keydown', key: 'd' },
  { t: 1.50, type: 'keydown', key: 'shift' },   // 회피 1회 (+2m)
  { t: 1.60, type: 'keyup', key: 'shift' },
  { t: 1.90, type: 'keydown', key: 'shift' },   // 회피 2회 (+2m) → 쿨타임 시작
  { t: 2.00, type: 'keyup', key: 'shift' },
  { t: 2.30, type: 'keydown', key: 'shift' },   // 3회째 — 쿨타임이라 발동하지 않음
  { t: 2.40, type: 'keyup', key: 'shift' },
  { t: 3.00, type: 'keyup', key: 'd' },
].sort((a, b) => a.t - b.t);
export const DODGE_DURATION = 4.5;

// ③ E 상호작용: 광원(3,3) → 중간지점(9,3) → 목표(15,3). 간격 6m로 3열에 담는다.
// 이동은 전부 빔 위(y=3)라 안전하다.
export const DEMO_INTERACT = {
  cols: 3, rows: 2,
  cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  litCells: [[0, 0]],
  source: { cell: [0, 0], dir: 'E' },
  waypoint: { cell: [1, 0], dir: 'E' },
  goal: { cell: [2, 0] },
  stands: [], items: [], spawnTriggers: [],
};
export const INTERACT_EVENTS = [
  { t: 0.60, type: 'keydown', key: 'e' },   // 점등 (빛 동쪽)
  { t: 0.80, type: 'keyup', key: 'e' },
  { t: 1.40, type: 'keydown', key: 'e' },   // 방향 전환 → 남쪽
  { t: 1.60, type: 'keyup', key: 'e' },
  { t: 2.20, type: 'keydown', key: 'e' },   // → 서쪽
  { t: 2.40, type: 'keyup', key: 'e' },
  { t: 3.00, type: 'keydown', key: 'e' },   // → 북쪽
  { t: 3.20, type: 'keyup', key: 'e' },
  { t: 3.80, type: 'keydown', key: 'e' },   // → 다시 동쪽 (중간지점 활성)
  { t: 4.00, type: 'keyup', key: 'e' },
  { t: 4.40, type: 'keydown', key: 'd' },   // 2.25초 = 6.0m → x 3 → 9
  { t: 6.65, type: 'keyup', key: 'd' },
  { t: 7.10, type: 'keydown', key: 'e' },   // 중간지점 점등 → 빔이 목표까지
  { t: 7.30, type: 'keyup', key: 'e' },
  { t: 7.70, type: 'keydown', key: 'd' },   // x 9 → 15
  { t: 9.95, type: 'keyup', key: 'd' },
  { t: 10.40, type: 'keydown', key: 'e' },  // 클리어
  { t: 10.60, type: 'keyup', key: 'e' },
].sort((a, b) => a.t - b.t);
// 클리어 직후 0.5초만 두고 루프 — 딤 화면이 오래 남지 않게 한다.
export const INTERACT_DURATION = 11.1;

// ④ 거울: 광원(3,9) 동쪽 빔 → 거치대(15,9) → 북쪽 반사 → 목표(15,3).
// 조준점 (12,6)은 거치대 기준 45° 북서 — 정북은 스침각이라 반사되지 않는다.
export const DEMO_MIRROR = {
  cols: 3, rows: 2,
  cells: [[2, 0], [0, 1], [1, 1], [2, 1]],
  litCells: [[0, 1]],
  source: { cell: [0, 1], dir: 'E' },
  waypoint: null,
  goal: { cell: [2, 0] },
  stands: [{ id: 'm1', cell: [2, 1] }],
  items: [], spawnTriggers: [],
};
export const MIRROR_EVENTS = [
  { t: 0.50, type: 'keydown', key: 'd' },   // 4.0초 = 10.68m → x 3 → 13.68 (거치대까지 1.32m)
  { t: 4.50, type: 'keyup', key: 'd' },
  { t: 5.00, type: 'keydown', key: 'e' },   // 거울 배치 → 조정 모드
  { t: 5.20, type: 'keyup', key: 'e' },
  ...tween(5.50, 7.10, 16.5, 7.5, 12, 6),
  // hint는 첫 mousemove(5.50) 뒤에 와야 커서 위치가 정해진 뒤 화살표가 뜬다.
  // cx·cy는 회전 중심(거치대), r은 호의 반지름(m).
  { t: 5.60, type: 'hint', spin: 'ccw', cx: 15, cy: 9, r: 4 },
  { t: 7.50, type: 'click' },               // 각도 확정 → 빔 북쪽 → 목표 점등
  { t: 7.60, type: 'hint', spin: null },
].sort((a, b) => a.t - b.t);
export const MIRROR_DURATION = 9.5;

// 튜닝 데모: 일직선 복도 (Task 6에서 사용)
export const DEMO_TUNE = {
  cols: 5, rows: 1,
  cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  litCells: [[0, 0]],
  source: { cell: [0, 0], dir: 'E' },
  waypoint: null,
  goal: { cell: [4, 0] },
  stands: [],
  items: [],
  spawnTriggers: [],
};

// 튜닝 데모 타임라인 (Task 6에서 사용)
export const TUNE_EVENTS = [
  { t: 0.5, type: 'keydown', key: 'd' },
  { t: 4.3, type: 'keyup', key: 'd' },
  { t: 4.8, type: 'keydown', key: 'a' },
  { t: 8.6, type: 'keyup', key: 'a' },
  { t: 9.1, type: 'keydown', key: 'd' },
  { t: 12.9, type: 'keyup', key: 'd' },
  { t: 13.4, type: 'keydown', key: 'a' },
  { t: 17.2, type: 'keyup', key: 'a' },
].sort((a, b) => a.t - b.t);
export const TUNE_DURATION = 18;

// ── 기믹 데모 (조작 묘사 없음, 결과만) ──

// 기믹 ①: 광원(3,9) 동쪽 빔 → 거치대(15,9) → 북쪽 반사 → 목표(15,3).
// 거울을 조작하는 장면이므로 플레이어를 거치대 바로 앞(빔 위)에 세운다.
export const DEMO_GIMMICK_LIGHT = {
  cols: 3, rows: 2,
  cells: [[2, 0], [0, 1], [1, 1], [2, 1]],
  litCells: [[0, 1]],
  source: { cell: [0, 1], dir: 'E' },
  waypoint: null,
  goal: { cell: [2, 0] },
  stands: [{ id: 'm1', cell: [2, 1] }],
  items: [], spawnTriggers: [],
};
// 거치대(15,9)에서 서쪽으로 1.8m — 상호작용 거리 안이고 빔(y=9) 위라 어둠이 쌓이지 않는다.
export const GIMMICK_LIGHT_PLAYER = [13.2, 9];
export const GIMMICK_LIGHT_DURATION = 5.0;

// 기믹 ②: 광원(3,3) 동쪽 빔 → 거치대(9,3). 그림자를 자동 조준해 2초 만에 소멸시킨다.
export const DEMO_GIMMICK_SHADOW = {
  cols: 3, rows: 2,
  cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  litCells: [[0, 0]],
  source: { cell: [0, 0], dir: 'E' },
  waypoint: null,
  goal: { cell: [2, 1] },
  stands: [{ id: 'm1', cell: [1, 0] }],
  items: [], spawnTriggers: [],
};
// 플레이어는 거치대(9,3) 앞 빔 위 — 빛 위에 있으면 색적되지 않아(seesPlayer) 추격당하지 않고,
// 순찰 그림자는 정화 구역에 들어오지 못해 접촉도 없다.
export const GIMMICK_SHADOW_PLAYER = [7.2, 3];
// 그림자는 입사축(y=3)에서 충분히 떨어진 아래 칸에 둔다. 축 근처에 두면 그림자가 축을
// 가로지를 때 필요한 거울 법선이 180° 뒤집혀, 반사 결과는 그대로인데 거울만 한 바퀴 돈다.
// 즉시 조준이라 3.2초에 소멸, 뒤에 1.0초를 남긴다.
export const GIMMICK_SHADOW_SHADOWS = [[13, 9]];
export const GIMMICK_SHADOW_DURATION = 4.2;
export const GIMMICK_SHADOW_SEED = 11;

// ── 어둠 데모 ──
// 광원은 꺼진 채 시작한다 — 빛이 있으면 그 위가 안전해 패널티가 쌓이지 않는다.
// 안전지대는 점등과 무관하게 존재하므로, 광원 칸(x 0~6)을 벗어나면 어둠이 누적된다.
export const DEMO_DARK = {
  cols: 3, rows: 2,
  cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  litCells: [[0, 0]],
  source: { cell: [0, 0], dir: 'E' },
  waypoint: null,
  goal: { cell: [2, 1] },
  stands: [], items: [], spawnTriggers: [],
};
// 1.5초(4.0m) 동안 동쪽으로 걸어 x≈7 — 안전지대(x≤6) 밖 어둠에 들어가 그대로 버틴다.
// 어둠 진입 약 1.6초 + 9초 = 약 10.6초에 게임 오버.
export const DARK_EVENTS = [
  { t: 0.50, type: 'keydown', key: 'd' },
  { t: 2.00, type: 'keyup', key: 'd' },
].sort((a, b) => a.t - b.t);
export const DARK_DURATION = 12.0;

// ── 그림자 파훼법 데모 ──
// 그림자 AI는 플레이어 위치에 반응하므로, 시드를 고정해 매 루프 같은 장면이 나오게 한다.
// 아래 SEED 값은 테스트가 통과하도록 맞춘 값이다 (바꾸면 장면이 달라진다).

const OPEN_3x2 = {
  cols: 3, rows: 2,
  cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  litCells: [[0, 0]],
  source: { cell: [0, 0], dir: 'E' },
  waypoint: null,
  goal: { cell: [2, 1] },
  stands: [], items: [], spawnTriggers: [],
};

// 파훼 ①: 순찰 중인 그림자의 부채꼴 시야(전방 9m·90°) 밖으로 우회해 지나간다.
// 광원은 꺼진 채 — 빛 위에 있으면 애초에 색적되지 않아 시연이 성립하지 않는다.
export const DEMO_EVADE_PATROL = OPEN_3x2;
export const EVADE_PATROL_SHADOWS = [[12, 3]];
export const EVADE_PATROL_SEED = 1;
// 아래로 내려가 그림자 밑을 지나 동쪽으로 — 전방 시야를 피한다
export const EVADE_PATROL_EVENTS = [
  { t: 0.40, type: 'keydown', key: 's' },
  { t: 2.20, type: 'keyup', key: 's' },
  { t: 2.50, type: 'keydown', key: 'd' },
  { t: 5.50, type: 'keyup', key: 'd' },
].sort((a, b) => a.t - b.t);
export const EVADE_PATROL_DURATION = 7.0;

// 파훼 ②: 발각 → 추격 → 회피로 거리를 벌며 광원 안전지대(x ≤ 6)로 복귀 → 추격 해제.
// 그림자를 정면(동쪽)이 아니라 남동쪽 아래 칸에 둔다. 정면에 두면 도주로와 추격로가
// 겹쳐(추격 3.0 > 도주 2.67m/s) 잠깐만 나갔다 돌아와야 해서 "쫓기는 장면"이 남지 않는다.
// 비스듬히 두면 플레이어가 x≈13까지 나갔다 돌아오는 동안 3.3초간 추격이 이어진다.
export const DEMO_EVADE_CHASE = OPEN_3x2;
export const EVADE_CHASE_SHADOWS = [[13, 10]];
export const EVADE_CHASE_SEED = 23;
export const EVADE_CHASE_EVENTS = [
  { t: 0.40, type: 'keydown', key: 'd' },       // 동쪽으로 나가 t≈3.0에 색적당한다
  { t: 4.30, type: 'keyup', key: 'd' },         // 쫓기면서도 잠시 더 달아난다 (x≈13.2)
  { t: 4.35, type: 'keydown', key: 'a' },       // 되돌아 광원 쪽으로
  { t: 4.70, type: 'keydown', key: 'shift' },   // 회피 1회로 거리 벌기
  { t: 4.80, type: 'keyup', key: 'shift' },
  { t: 5.50, type: 'keydown', key: 'shift' },   // 회피 2회 (쿨타임 밖이라 발동)
  { t: 5.60, type: 'keyup', key: 'shift' },
  { t: 6.90, type: 'keyup', key: 'a' },         // 안전지대(t≈6.3 진입) 안에서 정지
].sort((a, b) => a.t - b.t);
export const EVADE_CHASE_DURATION = 7.8;

// 파훼 ③: 돌진은 색적 1초 뒤 + 그림자와 안전지대 거리가 12m 초과일 때 발동한다.
// 그림자를 플레이어 이동 경로의 "뒤쪽"(동쪽, 진행 방향 앞)이 아니라 진행 경로 옆(9,5)에
// 매복시킨다 — 순찰로 배회하다 우연히 플레이어를 보면(시드로 고정) 추격이 시작되는데,
// 플레이어가 계속 같은 방향(동쪽)으로 달아나는 중이라 추격 속력(3.0)과 도주 속력(2.67)의
// 차이(0.33m/s)만 좁혀져 1초의 색적 대기 동안 접촉하지 않는다. 광원(3,3)에서 충분히
// 멀어진 뒤(추격 중 자연히 x>15) 안전지대 12m 조건도 만족해 돌진 예고가 뜨고, 예고 직후
// 수직(북)으로 피하면 돌진은 예고 시작 시점의 좌표로 고정 직진해 허공을 가른다.
export const DEMO_EVADE_DASH = {
  cols: 3, rows: 2,
  cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  litCells: [[0, 0]],
  source: { cell: [0, 0], dir: 'E' },
  waypoint: null,
  goal: { cell: [2, 1] },
  stands: [], items: [], spawnTriggers: [],
};
export const EVADE_DASH_SHADOWS = [[9, 5]];
export const EVADE_DASH_SEED = 73;
export const EVADE_DASH_EVENTS = [
  { t: 0.40, type: 'keydown', key: 'd' },     // 동쪽으로 계속 달린다 (색적 t≈5.1, x≈14.9)
  { t: 6.25, type: 'keydown', key: 'shift' },  // 돌진 예고(t≈6.22) 직후 수직 회피
  { t: 6.35, type: 'keyup', key: 'shift' },
  { t: 6.25, type: 'keydown', key: 'w' },
  { t: 7.05, type: 'keyup', key: 'w' },
  { t: 7.15, type: 'keyup', key: 'd' },
].sort((a, b) => a.t - b.t);
// 어둠 여유: 루프 종료 시점의 어둠 체류가 약 8.2초로 게임 오버(9.0초)까지 0.8초 남는다.
// 타이밍을 늘리면 돌진 회피 데모가 "게임 오버" 화면으로 끝나므로, 테스트가 이를 지킨다.
export const EVADE_DASH_DURATION = 9.75;

// 파훼 ④: 광원(3,3) 동쪽 빔 → 거치대(9,3). 플레이어는 거치대 앞에 서서 거울을 돌린다.
// 거울은 남쪽(45°)을 향한 채 시작해 그림자 쪽으로 **0.5 rad/s로 천천히** 겨눈다 —
// 즉시 조준이면 "겨누는 동작"이 화면에 남지 않는다. 0.5초쯤 빛이 그림자를 물면 그림자가
// 빔에서 수직으로 빠져나가려 움직이고(약 2.5m), 거울이 계속 따라붙어 3.5초에 소멸한다.
//
// 그림자는 반드시 입사축(y=3)에서 떨어뜨려 둔다. 축 근처면 그림자가 축을 넘을 때마다
// 필요한 법선이 180° 뒤집혀, 반사 결과는 사실상 같은데 거울만 한 바퀴 도는 장면이 나온다.
export const DEMO_LIGHT_KILL = {
  cols: 3, rows: 2,
  cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  litCells: [[0, 0]],
  source: { cell: [0, 0], dir: 'E' },
  waypoint: null,
  goal: { cell: [2, 1] },
  stands: [{ id: 'm1', cell: [1, 0] }],
  items: [], spawnTriggers: [],
};
export const LIGHT_KILL_PLAYER = [7.2, 3];
export const LIGHT_KILL_SHADOWS = [[13, 9]];
export const LIGHT_KILL_SEED = 17;
export const LIGHT_KILL_AIM_RATE = 0.5;          // rad/s — 사람이 마우스를 돌리는 속도
export const LIGHT_KILL_START_ANGLE = Math.PI / 4;   // 남쪽 반사 — 그림자와 다른 방향
export const LIGHT_KILL_DURATION = 4.8;

// 에디터 데모 타임라인 (Task 7에서 사용)
export const EDIT_EVENTS = [
  { t: 0.5, type: 'tool', tool: 'floor' },
  { t: 1.0, type: 'paint', c: 0, r: 1 },
  { t: 1.35, type: 'paint', c: 1, r: 1 },
  { t: 1.7, type: 'paint', c: 2, r: 1 },
  { t: 2.05, type: 'paint', c: 3, r: 1 },
  { t: 2.4, type: 'paint', c: 4, r: 1 },
  { t: 3.2, type: 'tool', tool: 'source' },
  { t: 3.7, type: 'place', kind: 'source', c: 0, r: 1 },
  { t: 4.3, type: 'tool', tool: 'stand' },
  { t: 4.8, type: 'place', kind: 'stand', c: 2, r: 1 },
  { t: 5.4, type: 'tool', tool: 'goal' },
  { t: 5.9, type: 'place', kind: 'goal', c: 4, r: 1 },
].sort((a, b) => a.t - b.t);
export const EDIT_DURATION = 10;
