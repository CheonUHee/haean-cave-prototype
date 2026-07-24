// 라이브 미니 데모 러너 — 시뮬레이션 코어에 캔버스 렌더와 입력 시각화를 얹는다.
import { setupCanvas, draw } from '../render.js';
import { createDemoSim } from './demo-sim.js';

// 조작 묘사가 없는 데모(기믹·파훼법)는 overlay를 넘기지 않는다 — 아무것도 하지 않는 대역이 쓰인다.
const NO_OVERLAY = {
  press() {}, release() {}, click() {}, moveTo() {}, setSpin() {}, reset() {},
};

export function createGameDemo({ canvas, overlay = NO_OVERLAY, stageDef, events, duration,
                                 sourceOn = false, onFrame = null, hud = false,
                                 fogRelax = true, shadows = [], seed = null, setup = null,
                                 playerAt = null, sightCones = false }) {
  const ctx = setupCanvas(canvas, stageDef);
  const sim = createDemoSim({
    stageDef, events, duration, sourceOn, onFrame, fogRelax, shadows, seed, setup, playerAt,
    hooks: {
      onInput(ev) {
        if (ev.type === 'keydown') overlay.press(ev.key);
        else if (ev.type === 'keyup') overlay.release(ev.key);
        else if (ev.type === 'mousemove') overlay.moveTo(ev.x, ev.y);
        else if (ev.type === 'click') overlay.click();
        else if (ev.type === 'hint') overlay.setSpin(ev);
      },
      onReset() { overlay.reset(); },
    },
  });

  function drawFrame() {
    draw(ctx, {
      w: sim.w, player: sim.player, darknessInfo: sim.darknessInfo, toasts: sim.toasts,
      gameState: sim.state, cfg: sim.cfg, adjustStand: sim.adjustStand,
      simTime: sim.simTime, deaths: 0, stageId: '데모', statsText: '', hud, sightCones,
    });
  }

  return { tick: sim.tick, drawFrame, DT: sim.DT };
}

// 화면에 보이는 동안만 고정 timestep으로 tick+draw (탭 비활성 시 정지)
export function runWhenVisible(demo, canvas) {
  let running = false, rafId = 0, last = 0, acc = 0, inView = false;
  function frame(now) {
    if (!running) return;
    try {
      acc += Math.min(0.25, (now - last) / 1000);
      last = now;
      while (acc >= demo.DT) { demo.tick(); acc -= demo.DT; }
      demo.drawFrame();
    } catch (err) {
      console.error('데모 재생 중 오류 — 정지합니다', err);
      stop();
      // 슬롯 안의 데모면 그 슬롯만 비운다(.demo-slot:empty 규칙이 숨김).
      // 슬롯 밖(조작법 4분할 등)이면 기존대로 섹션 단위 폴백으로 넘어간다.
      const slot = canvas.closest('.demo-slot');
      if (slot) slot.innerHTML = '';
      else {
        const sec = canvas.closest('.sec');
        if (sec) sec.classList.add('demo-failed');
      }
      return;
    }
    rafId = requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true; last = performance.now(); acc = 0;
    rafId = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(rafId); }
  function update() { (inView && !document.hidden) ? start() : stop(); }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) inView = e.isIntersecting;
    update();
  }, { threshold: 0.2 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', update);
}
