import { CFG } from './config.js';
import { STAGE1 } from './maps/stage1.js';
import { STAGE2 } from './maps/stage2.js';
import { STAGE3 } from './maps/stage3.js';
import { makeWorld, retrace, isSafeAt, inSafeZone, fireTriggers } from './objects.js';
import { placeMirror, canRotate, rotateMirrorToward } from './mirrors.js';
import { makePlayer, tryDodge, updatePlayer } from './player.js';
import { makeDarkness, stepDarkness } from './darkness.js';
import { makeShadow, updateShadow } from './shadow.js';
import { snapshot, restore } from './save.js';
import { setupCanvas, draw, PPM } from './render.js';
import { buildPanel } from './debug.js';
import { CELL } from './grid.js';

// ── 상태 ──
const STAGES = { 1: STAGE1, 2: STAGE2, 3: STAGE3 };
let stageId = 1;
let w = makeWorld(STAGES[stageId], CFG);
let player = makePlayer(w.source.x, w.source.y);
let darkness = makeDarkness();
let darknessInfo = { stage: 0, speed: 1, gameOver: false, t: 0 };
let gameState = 'play';          // 'play' | 'adjust' | 'over' | 'clear'
let adjustStand = null;
let paused = false;
let simTime = 0, deaths = 0;
let saveSnap = snapshot(w, player);
let toasts = [];
let prevCell = w.grid.cellOf(player.x, player.y).join(',');

const canvas = document.getElementById('canvas');
let ctx = setupCanvas(canvas, STAGES[stageId]);
const keys = new Set();
const mouse = { x: 0, y: 0 };

function toast(text, ttl = 3) { toasts.push({ text, ttl }); }

// ── 입력 ──
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'p') paused = !paused;
  if (k === 'r') resetToSave();
  if (k === 'shift') {
    const [ix, iy] = inputDir();
    tryDodge(player, simTime, ix || player.fx, iy || player.fy, CFG);
  }
  if (k === 'e') interact();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;             // CSS 축소 보정
  mouse.x = (e.clientX - rect.left) * scale / PPM;
  mouse.y = (e.clientY - rect.top) * scale / PPM;
  if (gameState === 'adjust' && adjustStand) {
    rotateMirrorToward(adjustStand, mouse.x, mouse.y, CFG);
    retrace(w);
  }
});
canvas.addEventListener('click', () => {
  if (gameState === 'adjust') exitAdjust();
});

function inputDir() {
  let x = 0, y = 0;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  if (keys.has('w') || keys.has('arrowup')) y -= 1;
  if (keys.has('s') || keys.has('arrowdown')) y += 1;
  return [x, y];
}

function nearest(list, maxDist) {
  let best = null, bd = maxDist;
  for (const o of list) {
    const d = Math.hypot(player.x - o.x, player.y - o.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

const DIRS = ['N', 'E', 'S', 'W'];

function interact() {
  if (gameState === 'adjust') { exitAdjust(); return; }
  if (gameState !== 'play') return;
  // 목표
  if (w.goal.lit && Math.hypot(player.x - w.goal.x, player.y - w.goal.y) <= CFG.interactRadius) {
    w.goal.cleared = true; gameState = 'clear'; return;
  }
  // 광원/중간지점: 최초 상호작용 = 점등, 이후 = 빛 방향 순환
  for (const src of [w.source, ...(w.waypoint && w.waypoint.active ? [w.waypoint] : [])]) {
    if (Math.hypot(player.x - src.x, player.y - src.y) <= CFG.interactRadius) {
      if (!src.on) {
        src.on = true;
        toast(`빛을 밝혔다 (방향: ${src.dir})`);
      } else {
        src.dir = DIRS[(DIRS.indexOf(src.dir) + 1) % 4];
        toast(`빛 방향: ${src.dir}`);
      }
      retrace(w);
      return;
    }
  }
  // 거치대
  const st = nearest(w.stands, CFG.interactRadius);
  if (st) {
    if (!st.mirror) {
      const res = placeMirror(st, w.light.segs, CFG);
      if (res.error === 'unlit') { toast('어두워서 거울을 배치하기 어렵다. 빛을 거치대에 연결해 보자.'); return; }
      retrace(w);
      fire({ type: 'reachStand', stand: st.id });
      if (canRotate(st)) enterAdjust(st);
      else toast('방향이 고정된 거치대다.');
    } else if (canRotate(st)) {
      enterAdjust(st);
    } else {
      toast('방향이 고정된 거치대다.');
    }
  }
}

function enterAdjust(st) { gameState = 'adjust'; adjustStand = st; toast('마우스로 거울 각도 조정 — E 또는 클릭으로 확정'); }
function exitAdjust() { gameState = 'play'; adjustStand = null; }

function fire(ev) {
  for (const t of fireTriggers(w, ev)) {
    const [c, r] = t.spawnCell;
    const [ox, oy] = t.spawnOffset || [0, 0];
    // 스폰 즉시 플레이어를 바라본다 — 등 돌린 채 스폰돼 추격이 늦는 것 방지
    w.shadows.push(makeShadow(c * CELL + CELL / 2 + ox, r * CELL + CELL / 2 + oy,
                              player.x, player.y));
    toast('…무언가 나타났다!');
  }
}

function gameOver() {
  deaths += 1;
  gameState = 'over';
}

function resetToSave() {
  restore(w, player, saveSnap);
  darkness = makeDarkness();
  darknessInfo = { stage: 0, speed: 1, gameOver: false, t: 0 };
  gameState = 'play';
  adjustStand = null;
  simTime = 0;   // 다시 시작 시 타이머 리셋
}

let customDef = null;   // 커스텀 맵일 때의 스테이지 데이터 (stageId = 맵 이름)

function loadStage(n, data) {
  stageId = n;
  const def = data || STAGES[n];
  customDef = data || null;
  w = makeWorld(def, CFG);
  player = makePlayer(w.source.x, w.source.y);
  darkness = makeDarkness();
  darknessInfo = { stage: 0, speed: 1, gameOver: false, t: 0 };
  saveSnap = snapshot(w, player);
  simTime = 0; deaths = 0; gameState = 'play'; adjustStand = null; toasts = [];
  prevCell = w.grid.cellOf(player.x, player.y).join(',');
  ctx = setupCanvas(canvas, def);          // 스테이지별 캔버스 크기 재설정
  toast(typeof n === 'number' ? `${n}단계 시작` : `커스텀 맵 '${n}' 시작`);
}

// 에디터가 저장한 커스텀 맵(JSON 데이터 테이블) 로드
async function loadCustomStage(name) {
  const res = await fetch(`maps/custom/${encodeURIComponent(name)}.json?t=${Date.now()}`);
  if (!res.ok) { toast(`맵 로드 실패: ${name}`); return; }
  loadStage(name, await res.json());
}

function restart() { loadStage(stageId, customDef); }

// ── 시뮬레이션 1틱 (고정 timestep) ──
const DT = 1 / 60;
function tick() {
  toasts = toasts.filter(t => (t.ttl -= DT) > 0);
  if (gameState === 'over' || gameState === 'clear') return;   // 타이머도 일시 정지
  simTime += DT;

  // 플레이어 (거울 조정 중에는 이동 정지)
  if (gameState === 'play') {
    const [ix, iy] = inputDir();
    updatePlayer(player, { x: ix, y: iy }, DT, w.grid, darknessInfo.speed, CFG);
  }

  // 셀 진입 트리거
  const cellNow = w.grid.cellOf(player.x, player.y);
  if (cellNow.join(',') !== prevCell) {
    prevCell = cellNow.join(',');
    fire({ type: 'enterCell', cell: cellNow });
  }
  // 거치대 접근 트리거 (보조 거치대 도달 스폰)
  for (const st of w.stands) {
    if (Math.hypot(player.x - st.x, player.y - st.y) <= CFG.interactRadius) {
      fire({ type: 'reachStand', stand: st.id });
    }
  }
  // 유실물 획득
  for (const it of w.items) {
    if (!it.taken && Math.hypot(player.x - it.x, player.y - it.y) <= 0.8) {
      it.taken = true;
      toast('유실물을 획득했다.');
      fire({ type: 'pickupItem', item: it.id });
    }
  }

  // 어둠 패널티
  const safe = isSafeAt(w, player.x, player.y);
  darknessInfo = stepDarkness(darkness, safe, DT, CFG);
  if (darknessInfo.gameOver) { gameOver(); return; }

  // 세이브: 중간지점 활성 + 안전지대 최초 도착
  if (w.waypoint && w.waypoint.active && !w.waypoint.saved &&
      Math.abs(player.x - w.waypoint.x) <= CFG.safeHalf &&
      Math.abs(player.y - w.waypoint.y) <= CFG.safeHalf) {
    w.waypoint.saved = true;
    saveSnap = snapshot(w, player);
    toast('진행도가 저장되었다.');
  }

  // 그림자
  for (const sh of w.shadows) {
    const ev = updateShadow(sh, simTime, DT, w, player, safe, CFG);
    if (ev.contact) { gameOver(); return; }
    if (ev.died) toast('그림자가 빛에 소멸했다.');
  }
  w.shadows = w.shadows.filter(sh => !sh.dead);

  retrace(w);   // 패널 튜닝(사거리 등) 실시간 반영
}

// ── 루프 ──
let acc = 0, last = performance.now();
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= DT) { if (!paused) tick(); acc -= DT; }
  draw(ctx, {
    w, player, darknessInfo, toasts, gameState, cfg: CFG, adjustStand,
    simTime, deaths, stageId,
    statsText: `시간 ${simTime.toFixed(1)}s · 사망 ${deaths}회`,
  });
  requestAnimationFrame(frame);
}

buildPanel(document.getElementById('panel'), {
  pause: () => { paused = !paused; },
  step: () => { paused = true; tick(); },
  reset: resetToSave,
  restart,
  setStage: loadStage,
  setCustomStage: loadCustomStage,
});

// URL ?stage=2 (기본 단계) 또는 ?stage=<커스텀맵이름> — 에디터 '저장 후 플레이' 연결
{
  const param = new URLSearchParams(location.search).get('stage');
  if (param && STAGES[param]) loadStage(Number(param));
  else if (param) loadCustomStage(param);
}
requestAnimationFrame(frame);

// E2E 검증·브라우저 콘솔 디버깅용 핸들 (프로토타입 전용)
// step(n): 백그라운드 탭에서 rAF가 멈춰도 시뮬레이션을 n틱 수동 진행
window.__game = {
  get w() { return w; },
  get player() { return player; },
  get state() { return gameState; },
  get darkness() { return darknessInfo; },
  get simTime() { return simTime; },
  get deaths() { return deaths; },
  get stageId() { return stageId; },
  step(n = 1) { for (let i = 0; i < n; i++) tick(); },
  interact,
  setStage: loadStage,
  setCustomStage: loadCustomStage,
  cfg: CFG,
};
