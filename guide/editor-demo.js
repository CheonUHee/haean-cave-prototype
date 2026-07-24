// 에디터 미니 데모 — editor/core.js 상태 모델을 재사용, 간이 렌더러로 그린다.
// 시나리오: 바닥 페인팅 → 광원·거치대·목표 배치.
import { newStage, toggleFloor, placeObject } from '../editor/core.js';
import { CELL } from '../grid.js';
import { PPM } from '../render.js';
import { makeSequencer } from './sequence.js';

const DT = 1 / 60;
const COLS = 5, ROWS = 3;

export function createEditorDemo({ canvas, wrapEl, palette, cursorEl, events, duration }) {
  canvas.width = COLS * CELL * PPM;
  canvas.height = ROWS * CELL * PPM;
  const ctx = canvas.getContext('2d');
  let stage, seq;

  function reset() {
    stage = newStage(COLS, ROWS);
    seq = makeSequencer(events, duration);
    for (const b of palette.querySelectorAll('button')) b.classList.remove('on');
    cursorEl.style.display = 'none';
  }

  function cursorAt(x, y) {   // wrapEl 기준 px
    cursorEl.style.display = 'block';
    cursorEl.style.left = x + 'px';
    cursorEl.style.top = y + 'px';
  }

  function cursorOnCell(c, r) {
    const scale = canvas.clientWidth / canvas.width;
    cursorAt(canvas.offsetLeft + (c + 0.5) * CELL * PPM * scale,
             canvas.offsetTop + (r + 0.5) * CELL * PPM * scale);
  }

  function cursorOnEl(el) {
    const r = el.getBoundingClientRect();
    const wr = wrapEl.getBoundingClientRect();
    cursorAt(r.left - wr.left + r.width / 2, r.top - wr.top + r.height / 2);
  }

  function apply(ev) {
    if (ev.type === 'tool') {
      for (const b of palette.querySelectorAll('button'))
        b.classList.toggle('on', b.dataset.tool === ev.tool);
      cursorOnEl(palette.querySelector('[data-tool="' + ev.tool + '"]'));
    } else if (ev.type === 'paint') {
      cursorOnCell(ev.c, ev.r);
      toggleFloor(stage, ev.c, ev.r);   // 타임라인은 같은 칸을 두 번 칠하지 않는다
    } else if (ev.type === 'place') {
      cursorOnCell(ev.c, ev.r);
      placeObject(stage, ev.kind, ev.c, ev.r);
    }
  }

  function tick() {
    const { fired, looped } = seq.advance(DT);
    if (looped) { reset(); return; }
    for (const ev of fired) apply(ev);
  }

  function drawFrame() {
    const px = (m) => m * PPM;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#2a2a44';
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(px(c * CELL), 0); ctx.lineTo(px(c * CELL), canvas.height); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, px(r * CELL)); ctx.lineTo(canvas.width, px(r * CELL)); ctx.stroke();
    }
    ctx.fillStyle = '#6a58d6';
    for (const [c, r] of stage.cells) {
      ctx.fillRect(px(c * CELL) + 1, px(r * CELL) + 1, px(CELL) - 2, px(CELL) - 2);
    }
    ctx.textAlign = 'center';
    const glyph = (cell, color, icon, name) => {
      const cx = px((cell[0] + 0.5) * CELL), cy = px((cell[1] + 0.5) * CELL);
      ctx.fillStyle = color;
      ctx.font = 'bold 18px system-ui';
      ctx.fillText(icon, cx, cy + 2);          // 아이콘: 칸 중앙
      ctx.font = 'bold 11px system-ui';
      ctx.fillText(name, cx, cy + 18);         // 이름: 아이콘 아래 줄
    };
    if (stage.source) glyph(stage.source.cell, '#ffd257', '◆', '광원');
    for (const s of stage.stands) glyph(s.cell, '#38c7dd', '▢', '거치대');
    if (stage.goal) glyph(stage.goal.cell, '#6fdc6f', '⚑', '목표');
  }

  reset();
  return { tick, drawFrame, DT };
}
