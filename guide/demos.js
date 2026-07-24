// 안내 페이지 데모 장착. 데모 하나가 죽어도 나머지·본문은 살아있도록 격리한다.
import { createGameDemo, runWhenVisible } from './demo.js';
import { createOverlay } from './overlay.js';
import { createEditorDemo } from './editor-demo.js';
import { CFG } from '../config.js';
import { DEMO_MOVE, MOVE_EVENTS, MOVE_DURATION,
         DEMO_DODGE, DODGE_EVENTS, DODGE_DURATION,
         DEMO_INTERACT, INTERACT_EVENTS, INTERACT_DURATION,
         DEMO_MIRROR, MIRROR_EVENTS, MIRROR_DURATION,
         DEMO_TUNE, TUNE_EVENTS, TUNE_DURATION,
         EDIT_EVENTS, EDIT_DURATION,
         DEMO_GIMMICK_LIGHT, GIMMICK_LIGHT_DURATION, GIMMICK_LIGHT_PLAYER,
         DEMO_GIMMICK_SHADOW, GIMMICK_SHADOW_DURATION, GIMMICK_SHADOW_SEED,
         GIMMICK_SHADOW_SHADOWS, GIMMICK_SHADOW_PLAYER,
         DEMO_DARK, DARK_EVENTS, DARK_DURATION,
         DEMO_EVADE_PATROL, EVADE_PATROL_EVENTS, EVADE_PATROL_DURATION,
         EVADE_PATROL_SEED, EVADE_PATROL_SHADOWS,
         DEMO_EVADE_CHASE, EVADE_CHASE_EVENTS, EVADE_CHASE_DURATION,
         EVADE_CHASE_SEED, EVADE_CHASE_SHADOWS,
         DEMO_EVADE_DASH, EVADE_DASH_EVENTS, EVADE_DASH_DURATION,
         EVADE_DASH_SEED, EVADE_DASH_SHADOWS,
         DEMO_LIGHT_KILL, LIGHT_KILL_DURATION, LIGHT_KILL_SEED, LIGHT_KILL_SHADOWS,
         LIGHT_KILL_PLAYER, LIGHT_KILL_AIM_RATE, LIGHT_KILL_START_ANGLE,
       } from './demo-maps.js';
import { gimmickLightScene, gimmickShadowScene, trackShadowScene } from './demo-scenes.js';

function mount(id, build) {
  const section = document.getElementById(id);
  if (!section) { console.error('데모 섹션 없음: ' + id); return; }
  try {
    build(section);
  } catch (err) {
    console.error('데모 초기화 실패: ' + id, err);
    if (section) section.classList.add('demo-failed');   // CSS가 캔버스를 숨기고 대체 문구 표시
  }
}

// 데모 하나를 자기 자리에만 마운트한다. 하나가 실패해도 다른 데모는 살아남는다.
// build(canvas, wrap)에서 예외가 나면 그 자리만 비우고(부모 CSS가 숨김) 로그를 남긴다.
function mountSlot(name, build) {
  const slot = document.querySelector(`.demo-slot[data-demo="${name}"]`);
  if (!slot) { console.error('데모 자리 없음: ' + name); return; }
  try {
    const wrap = slot.querySelector('.demo-wrap');
    const canvas = slot.querySelector('canvas');
    if (!wrap || !canvas) throw new Error('demo-wrap/canvas 골격이 없음');
    build(canvas, wrap);
  } catch (err) {
    console.error('데모 초기화 실패: ' + name, err);
    slot.innerHTML = '';   // 자리를 비우면 .demo-slot:empty 규칙이 숨긴다
  }
}

// 조작법: 입력별 미니 데모 4개. 각 셀은 자기 입력의 키캡만 보여준다.
const PLAY_DEMOS = {
  move: { stageDef: DEMO_MOVE, events: MOVE_EVENTS, duration: MOVE_DURATION,
          sourceOn: true, fogRelax: true, keys: ['w', 'a', 's', 'd'] },
  dodge: { stageDef: DEMO_DODGE, events: DODGE_EVENTS, duration: DODGE_DURATION,
           sourceOn: true, fogRelax: true, keys: ['w', 'a', 's', 'd', 'shift'] },
  interact: { stageDef: DEMO_INTERACT, events: INTERACT_EVENTS, duration: INTERACT_DURATION,
              sourceOn: false, fogRelax: true, keys: ['w', 'a', 's', 'd', 'e'] },
  mirror: { stageDef: DEMO_MIRROR, events: MIRROR_EVENTS, duration: MIRROR_DURATION,
            sourceOn: true, fogRelax: true, keys: ['w', 'a', 's', 'd', 'e'] },
};

mount('demo-play', (sec) => {
  for (const [name, def] of Object.entries(PLAY_DEMOS)) {
    const cell = sec.querySelector(`[data-demo="${name}"]`);
    if (!cell) { console.error('데모 셀 없음: ' + name); continue; }
    const wrap = cell.querySelector('.demo-wrap');
    const canvas = cell.querySelector('canvas');
    const overlay = createOverlay(wrap, canvas, def.keys);
    const demo = createGameDemo({ canvas, overlay, stageDef: def.stageDef,
                                  events: def.events, duration: def.duration,
                                  sourceOn: def.sourceOn, fogRelax: def.fogRelax });
    runWhenVisible(demo, canvas);
  }
});

mount('demo-tune', (sec) => {
  const wrap = sec.querySelector('.demo-wrap');
  const canvas = sec.querySelector('canvas');
  const overlay = createOverlay(wrap, canvas, ['w', 'a', 's', 'd']);
  const speedEl = sec.querySelector('[data-slider="speed"] input');
  const lightEl = sec.querySelector('[data-slider="light"] input');
  const speedVal = sec.querySelector('[data-slider="speed"] .v');
  const lightVal = sec.querySelector('[data-slider="light"] .v');
  const cursor = sec.querySelector('.slider-cursor');

  // 마우스 아이콘을 슬라이더 노브 위치에 얹는다 (.demo-sliders 기준 절대 위치).
  // range thumb은 폭(THUMB)만큼 트랙 안쪽에서만 움직이므로 그만큼 보정해야
  // 양 끝에서 커서와 노브가 어긋나지 않는다.
  const THUMB = 16;
  function cursorOnKnob(slider) {
    const r = slider.getBoundingClientRect();
    const p = cursor.parentElement.getBoundingClientRect();
    const min = Number(slider.min), max = Number(slider.max);
    const f = (Number(slider.value) - min) / (max - min);
    const x = THUMB / 2 + f * (r.width - THUMB);
    cursor.style.display = 'block';
    cursor.style.left = (r.left - p.left + x) + 'px';
    cursor.style.top = (r.top - p.top - 8) + 'px';
  }

  const demo = createGameDemo({
    canvas, overlay, stageDef: DEMO_TUNE,
    events: TUNE_EVENTS, duration: TUNE_DURATION, sourceOn: true,
    onFrame(t, cfg) {
      // 전반: 이동 속력 스윕 / 후반: 빛 사거리 스윕 — 값이 게임에 즉시 반영
      if (t < TUNE_DURATION / 2) {
        const v = 2.6 + 1.4 * Math.sin(t * 0.9);
        cfg.presets[cfg.preset] = v;
        speedEl.value = v;
        speedVal.textContent = v.toFixed(2);
        cursorOnKnob(speedEl);
      } else {
        cfg.presets[cfg.preset] = CFG.presets[CFG.preset];   // 속력은 기본값으로 복귀
        speedEl.value = CFG.presets[CFG.preset];
        speedVal.textContent = CFG.presets[CFG.preset].toFixed(2);
        const v = 19 + 11 * Math.sin((t - TUNE_DURATION / 2) * 0.9);
        cfg.lightRange = v;
        lightEl.value = v;
        lightVal.textContent = v.toFixed(1);
        cursorOnKnob(lightEl);
      }
    },
  });
  runWhenVisible(demo, canvas);
});

mount('demo-edit', (sec) => {
  const wrap = sec.querySelector('.demo-wrap');
  const canvas = sec.querySelector('canvas');
  const demo = createEditorDemo({
    canvas, wrapEl: wrap,
    palette: sec.querySelector('.demo-palette'),
    cursorEl: sec.querySelector('.demo-cursor'),
    events: EDIT_EVENTS, duration: EDIT_DURATION,
  });
  runWhenVisible(demo, canvas);
});

// 기믹 데모 — 조작 묘사 없이 결과만 보여준다(오버레이 없음).
// 거울을 조작하는 장면이므로 플레이어를 거치대 앞에 세운다(playerAt).
mountSlot('gimmick-light', (canvas) => {
  const demo = createGameDemo({
    canvas, stageDef: DEMO_GIMMICK_LIGHT, events: [],
    duration: GIMMICK_LIGHT_DURATION, sourceOn: true,
    playerAt: GIMMICK_LIGHT_PLAYER, ...gimmickLightScene(),
  });
  runWhenVisible(demo, canvas);
});

mountSlot('gimmick-shadow', (canvas) => {
  const demo = createGameDemo({
    canvas, stageDef: DEMO_GIMMICK_SHADOW, events: [],
    duration: GIMMICK_SHADOW_DURATION, sourceOn: true,
    seed: GIMMICK_SHADOW_SEED, shadows: GIMMICK_SHADOW_SHADOWS,
    playerAt: GIMMICK_SHADOW_PLAYER, ...gimmickShadowScene(),
  });
  runWhenVisible(demo, canvas);
});

// 어둠 데모 — 시야 축소가 주제라 확정 튜닝값을 그대로 쓴다(fogRelax:false).
// 키 입력 묘사는 넣지 않는다 — 보여줄 것은 조작이 아니라 어둠에 머문 시간의 결과다.
mountSlot('darkness', (canvas) => {
  const demo = createGameDemo({
    canvas, stageDef: DEMO_DARK, events: DARK_EVENTS,
    duration: DARK_DURATION, fogRelax: false,
  });
  runWhenVisible(demo, canvas);
});

// 파훼법 데모 — 조작 묘사 없이 상황만 보여준다(오버레이 없음).
// 네 데모 모두 그림자의 색적 부채꼴을 표시해 "무엇을 피하는 것인지"가 보이게 한다.
mountSlot('evade-patrol', (canvas) => {
  const demo = createGameDemo({
    canvas, stageDef: DEMO_EVADE_PATROL, events: EVADE_PATROL_EVENTS,
    duration: EVADE_PATROL_DURATION, seed: EVADE_PATROL_SEED,
    shadows: EVADE_PATROL_SHADOWS, sightCones: true,
  });
  runWhenVisible(demo, canvas);
});

mountSlot('evade-chase', (canvas) => {
  const demo = createGameDemo({
    canvas, stageDef: DEMO_EVADE_CHASE, events: EVADE_CHASE_EVENTS,
    duration: EVADE_CHASE_DURATION, seed: EVADE_CHASE_SEED,
    shadows: EVADE_CHASE_SHADOWS, sightCones: true,
  });
  runWhenVisible(demo, canvas);
});

mountSlot('evade-dash', (canvas) => {
  const demo = createGameDemo({
    canvas, stageDef: DEMO_EVADE_DASH, events: EVADE_DASH_EVENTS,
    duration: EVADE_DASH_DURATION, seed: EVADE_DASH_SEED,
    shadows: EVADE_DASH_SHADOWS, sightCones: true,
  });
  runWhenVisible(demo, canvas);
});

mountSlot('light-kill', (canvas) => {
  const demo = createGameDemo({
    canvas, stageDef: DEMO_LIGHT_KILL, events: [],
    duration: LIGHT_KILL_DURATION, sourceOn: true,
    seed: LIGHT_KILL_SEED, shadows: LIGHT_KILL_SHADOWS,
    playerAt: LIGHT_KILL_PLAYER, sightCones: true,
    ...trackShadowScene({ aimRate: LIGHT_KILL_AIM_RATE, startAngle: LIGHT_KILL_START_ANGLE }),
  });
  runWhenVisible(demo, canvas);
});
