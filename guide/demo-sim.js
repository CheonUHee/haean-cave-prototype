// 데모 시뮬레이션 코어 — DOM 없이 도는 부분만. 렌더·오버레이는 demo.js가 얹는다.
// main.js 배선의 축소판 (그림자·유실물·스폰 트리거는 데모 맵에 없어 생략).
import { CFG } from '../config.js';
import { makeWorld, retrace, isSafeAt } from '../objects.js';
import { makePlayer, tryDodge, updatePlayer } from '../player.js';
import { makeDarkness, stepDarkness } from '../darkness.js';
import { placeMirror, canRotate, rotateMirrorToward } from '../mirrors.js';
import { makeSequencer } from './sequence.js';
import { makeShadow, updateShadow } from '../shadow.js';
import { makeRng } from './rng.js';

const DT = 1 / 60;
const DIRS = ['N', 'E', 'S', 'W'];

// hooks: { onInput(ev), onReset() } — 오버레이 시각화용. 없어도 동작한다.
// shadows: [[x, y], …] 미터 좌표 — 리셋 때 그 자리에 생성한다(플레이어를 바라본 채).
// seed: 있으면 시드 고정 난수로 그림자를 굴려 매 루프 같은 장면이 나온다.
// setup(w, cfg): 리셋 직후 월드를 손볼 기회 (거울 미리 배치 등).
// playerAt: [x, y] 미터 좌표 — 기본값(광원 위) 대신 여기서 시작한다.
//   거울을 조작하는 장면처럼 "캐릭터가 거치대 앞에 서 있어야" 읽히는 데모에 쓴다.
//   빛 궤적 위(반폭 0.6m)나 안전지대 안이어야 어둠 패널티가 쌓이지 않는다.
export function createDemoSim({ stageDef, events, duration, sourceOn = false,
                                onFrame = null, hooks = {}, fogRelax = true,
                                shadows = [], seed = null, setup = null,
                                playerAt = null }) {
  const cfg = structuredClone(CFG);   // 데모별 독립 설정 — 실제 게임 CFG에 영향 없음
  cfg.showDebug = false;
  // 미니 캔버스(252×168)에서는 확정 튜닝값(fogAlpha 1 · 시야 3.5/2.5/1m)이면 캐릭터 주변만
  // 겨우 보여 시연이 읽히지 않는다. 어둠 칸은 규칙대로 두되 안개와 시야만 완화한다.
  // 어둠 단계가 오르는 데모(파훼법)도 있으므로 1·2단계 시야까지 함께 넓힌다.
  // 어둠의 시야 축소를 보여줄 데모는 fogRelax:false로 실제 값을 쓴다.
  if (fogRelax) {
    cfg.fogAlpha = 0.55;
    cfg.vision0 = 7; cfg.vision1 = 5; cfg.vision2 = 3.5;
  }
  let w, player, darkness, darknessInfo, gameState, adjustStand, simTime, toasts, seq, rng;
  const keys = new Set();
  // 어둠 게임 오버 뒤 결말이 읽히도록 잠깐 화면을 유지한 뒤 리셋한다(초). 접촉은 즉시 리셋.
  const GAME_OVER_HOLD = 0.9;
  let pendingReset = 0;

  function toast(text, ttl = 2.5) { toasts.push({ text, ttl }); }

  function reset() {
    w = makeWorld(stageDef, cfg);
    player = makePlayer(...(playerAt || [w.source.x, w.source.y]));
    darkness = makeDarkness();
    darknessInfo = { stage: 0, speed: 1, gameOver: false, t: 0 };
    gameState = 'play'; adjustStand = null; simTime = 0; toasts = [];
    keys.clear();
    pendingReset = 0;
    if (sourceOn) { w.source.on = true; retrace(w); }
    // 루프마다 시드를 다시 적용해야 같은 장면이 재현된다
    rng = seed === null ? Math.random : makeRng(seed);
    w.shadows = shadows.map(([sx, sy]) => makeShadow(sx, sy, player.x, player.y));
    if (setup) setup(w, cfg);
    seq = makeSequencer(events, duration);
    if (hooks.onReset) hooks.onReset();
  }

  function inputDir() {
    let x = 0, y = 0;
    if (keys.has('a')) x -= 1;
    if (keys.has('d')) x += 1;
    if (keys.has('w')) y -= 1;
    if (keys.has('s')) y += 1;
    return [x, y];
  }

  // main.js interact()의 데모 축소판 — 목표 / 광원·중간지점 / 거치대
  function interact() {
    if (gameState === 'adjust') { gameState = 'play'; adjustStand = null; return; }
    if (gameState !== 'play') return;
    if (w.goal.lit && Math.hypot(player.x - w.goal.x, player.y - w.goal.y) <= cfg.interactRadius) {
      w.goal.cleared = true; gameState = 'clear'; return;
    }
    for (const src of [w.source, ...(w.waypoint && w.waypoint.active ? [w.waypoint] : [])]) {
      if (Math.hypot(player.x - src.x, player.y - src.y) <= cfg.interactRadius) {
        if (!src.on) { src.on = true; toast('빛을 밝혔다 (방향: ' + src.dir + ')'); }
        else { src.dir = DIRS[(DIRS.indexOf(src.dir) + 1) % 4]; toast('빛 방향: ' + src.dir); }
        retrace(w);
        return;
      }
    }
    let best = null, bd = cfg.interactRadius;
    for (const st of w.stands) {
      const d = Math.hypot(player.x - st.x, player.y - st.y);
      if (d < bd) { bd = d; best = st; }
    }
    if (best) {
      if (!best.mirror) {
        const res = placeMirror(best, w.light.segs, cfg);
        if (res.error === 'unlit') { toast('어두워서 거울을 배치하기 어렵다.'); return; }
        retrace(w);
      }
      if (canRotate(best)) {
        gameState = 'adjust'; adjustStand = best;
        toast('마우스로 거울 각도 조정');
      } else {
        toast('방향이 고정된 거치대다.');
      }
    }
  }

  function apply(ev) {
    if (hooks.onInput) hooks.onInput(ev);
    switch (ev.type) {
      case 'keydown':
        keys.add(ev.key);
        if (ev.key === 'shift') {
          const [ix, iy] = inputDir();
          tryDodge(player, simTime, ix || player.fx, iy || player.fy, cfg);
        }
        if (ev.key === 'e') interact();
        break;
      case 'keyup':
        keys.delete(ev.key);
        break;
      case 'mousemove':
        if (gameState === 'adjust' && adjustStand) {
          rotateMirrorToward(adjustStand, ev.x, ev.y, cfg);
          retrace(w);
        }
        break;
      case 'click':
        if (gameState === 'adjust') { gameState = 'play'; adjustStand = null; }
        break;
    }
  }

  function tick() {
    // 직전 틱에서 게임오버(어둠 3단계)를 알렸다면, 결말이 읽히도록 잠깐 화면을 유지한 뒤 리셋한다
    if (pendingReset > 0) {
      pendingReset -= DT;
      if (pendingReset <= 0) { reset(); }
      return;   // 유지 중에는 시뮬레이션을 멈춘다 (게임 오버 화면 그대로)
    }
    toasts = toasts.filter(t => (t.ttl -= DT) > 0);
    const { fired, looped } = seq.advance(DT);
    if (looped) { reset(); return; }
    for (const ev of fired) apply(ev);
    if (gameState === 'over' || gameState === 'clear') return;
    simTime += DT;
    if (gameState === 'play') {
      const [ix, iy] = inputDir();
      updatePlayer(player, { x: ix, y: iy }, DT, w.grid, darknessInfo.speed, cfg);
    }
    const safe = isSafeAt(w, player.x, player.y);
    darknessInfo = stepDarkness(darkness, safe, DT, cfg);
    // 3단계(게임오버) 상태로 전환하고 잠깐 화면을 유지한 뒤 리셋한다
    if (darknessInfo.gameOver) { gameState = 'over'; pendingReset = GAME_OVER_HOLD; return; }
    if (w.waypoint && w.waypoint.active && !w.waypoint.saved &&
        Math.abs(player.x - w.waypoint.x) <= cfg.safeHalf &&
        Math.abs(player.y - w.waypoint.y) <= cfg.safeHalf) {
      w.waypoint.saved = true;
      toast('진행도가 저장되었다.');
    }
    // 그림자 (main.js와 같은 순서). 접촉하면 데모는 곧장 처음부터
    for (const sh of w.shadows) {
      const ev = updateShadow(sh, simTime, DT, w, player, safe, cfg, rng);
      if (ev.contact) { reset(); return; }
    }
    w.shadows = w.shadows.filter(sh => !sh.dead);
    retrace(w);
    if (onFrame) onFrame(simTime, cfg, w);
  }

  reset();
  return {
    tick, reset, DT,
    get w() { return w; },
    get player() { return player; },
    get state() { return gameState; },
    get adjustStand() { return adjustStand; },
    get darknessInfo() { return darknessInfo; },
    get toasts() { return toasts; },
    get simTime() { return simTime; },
    get cfg() { return cfg; },
  };
}
