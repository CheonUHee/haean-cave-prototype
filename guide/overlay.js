// 가상 키캡 + 마우스 커서 + 회전 화살표 — 데모에 주입되는 입력을 시각화한다.
import { PPM } from '../render.js';

const LABELS = { w: 'W', a: 'A', s: 'S', d: 'D', shift: 'Shift', e: 'E' };
const WASD = ['w', 'a', 's', 'd'];

function spinSvg(dir) {
  const ccw = dir !== 'cw';
  // 중심(50,50) 반지름 40의 상단 90° 호. 북동=(78.28,21.72), 북서=(21.72,21.72).
  // 화살촉은 호의 끝점에서 진행 방향(접선)으로 회전시킨다 —
  // ccw는 북서에서 왼쪽·아래로, cw는 북동에서 오른쪽·아래로 향한다.
  const path = ccw
    ? 'M78.28,21.72 A40,40 0 0 0 21.72,21.72'
    : 'M21.72,21.72 A40,40 0 0 1 78.28,21.72';
  const tip = ccw ? { x: 21.72, y: 21.72, a: 135 } : { x: 78.28, y: 21.72, a: 45 };
  const head = '<polygon points="0,-7 13,0 0,7" fill="#7ee0ee" ' +
    'transform="translate(' + tip.x + ',' + tip.y + ') rotate(' + tip.a + ')"/>';
  return '<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">' +
    '<path d="' + path + '" fill="none" stroke="#7ee0ee" stroke-width="5" ' +
    'stroke-linecap="round"/>' + head + '</svg>';
}

// wrapEl: position:relative인 .demo-wrap (canvas 포함)
// keys: 표시할 키 배열. WASD가 하나라도 있으면 네 개를 ㅗ 모양으로 모두 그린다
//       (안 쓰는 키도 자리에 보여야 조작 체계가 읽힌다).
export function createOverlay(wrapEl, canvas, keys = ['w', 'a', 's', 'd', 'shift', 'e']) {
  const bar = document.createElement('div');
  bar.className = 'demo-keys';
  const caps = {};

  const wantsWasd = keys.some(k => WASD.includes(k));
  if (wantsWasd) {
    const pad = document.createElement('div');
    pad.className = 'kb-wasd';
    for (const id of WASD) {
      const k = document.createElement('span');
      k.className = 'keycap k-' + id;
      k.textContent = LABELS[id];
      pad.appendChild(k);
      caps[id] = k;
    }
    bar.appendChild(pad);
  }
  const etc = keys.filter(k => !WASD.includes(k));
  if (etc.length) {
    const row = document.createElement('div');
    row.className = 'kb-etc';
    for (const id of etc) {
      const k = document.createElement('span');
      k.className = 'keycap';
      k.textContent = LABELS[id] || id.toUpperCase();
      row.appendChild(k);
      caps[id] = k;
    }
    bar.appendChild(row);
  }

  const cursor = document.createElement('div');
  cursor.className = 'demo-cursor';
  cursor.textContent = '🖱️';
  cursor.style.display = 'none';
  const spin = document.createElement('div');
  spin.className = 'demo-spin';
  spin.style.display = 'none';
  wrapEl.appendChild(bar);
  wrapEl.appendChild(cursor);
  wrapEl.appendChild(spin);

  const scale = () => canvas.clientWidth / canvas.width;

  return {
    press(k) { if (caps[k]) caps[k].classList.add('on'); },
    release(k) { if (caps[k]) caps[k].classList.remove('on'); },
    click() { cursor.classList.add('click'); setTimeout(() => cursor.classList.remove('click'), 200); },
    moveTo(mx, my) {   // 미터 좌표 → 캔버스 CSS 픽셀 (CSS 축소 보정)
      const s = scale();
      // 숨겨진 동안 left/top이 0이라, 첫 표시에 트랜지션이 걸리면 좌상단에서 날아온다.
      // 첫 프레임만 트랜지션을 끄고 제자리에 놓은 뒤 되돌린다.
      const first = cursor.style.display === 'none';
      if (first) cursor.style.transition = 'none';
      cursor.style.display = 'block';
      cursor.style.left = (canvas.offsetLeft + mx * PPM * s) + 'px';
      cursor.style.top = (canvas.offsetTop + my * PPM * s) + 'px';
      if (first) { void cursor.offsetWidth; cursor.style.transition = ''; }
    },
    // opt: { spin:'cw'|'ccw'|null, cx, cy, r } — 회전 중심(m)과 반지름(m)에 호를 고정한다.
    setSpin(opt) {
      if (!opt || !opt.spin) { spin.style.display = 'none'; return; }
      const s = scale();
      const size = opt.r * 2 * PPM * s;
      spin.innerHTML = spinSvg(opt.spin);
      spin.style.width = size + 'px';
      spin.style.height = size + 'px';
      spin.style.left = (canvas.offsetLeft + (opt.cx - opt.r) * PPM * s) + 'px';
      spin.style.top = (canvas.offsetTop + (opt.cy - opt.r) * PPM * s) + 'px';
      spin.style.display = 'block';
    },
    reset() {
      for (const k of Object.values(caps)) k.classList.remove('on');
      cursor.style.display = 'none';
      spin.style.display = 'none';
    },
  };
}
