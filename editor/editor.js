// 맵 에디터 UI — core.js(순수 상태 모델) 위의 DOM/캔버스 레이어.
import { newStage, toggleFloor, toggleLit, placeObject, removeObjectAt, objectAt,
         isFloor, serialize, deserialize } from './core.js';
import { validateStage } from '../maps/validate.js';
import { localMaps, saveLocalMap, loadLocalMap, encodeShare, serverMaps } from '../maps/store.js';
import { STAGE1 } from '../maps/stage1.js';
import { STAGE2 } from '../maps/stage2.js';
import { STAGE3 } from '../maps/stage3.js';

const TEMPLATES = { '1단계': STAGE1, '2단계': STAGE2, '3단계': STAGE3 };
const DIRS = ['N', 'E', 'S', 'W'];
// 방향 고정 각 프리셋 — n=(-sin a, cos a) 기준 반사 조합
const LOCK_PRESETS = [
  ['／ 남동면 (N→E · W→S)', -Math.PI / 4],
  ['／ 북서면 (E→N · S→W)', Math.PI * 3 / 4],
  ['＼ 남서면 (E→S · N→W)', Math.PI / 4],
  ['＼ 북동면 (W→N · S→E)', -Math.PI * 3 / 4],
];
// 도구는 성격별 3그룹: 타일 칠하기 / 오브젝트 배치 / 편집(배치와 다른 성격 — 버튼 색도 구분)
const TOOL_GROUPS = [
  ['타일', [['floor', '바닥'], ['lit', '밝은 칸']]],
  ['오브젝트', [['source', '광원'], ['waypoint', '중간지점'], ['goal', '목표지점'],
              ['stand', '거울거치대'], ['lock', '방향고정'], ['aux', '보조거치대'],
              ['item', '유실물'], ['spawn', '그림자']]],
  ['편집', [['select', '선택'], ['erase', '지우개']]],
];
const KIND_LABEL = { source: '광원', waypoint: '중간지점', goal: '목표지점', stand: '거울거치대',
                     lock: '방향 고정 거치대', aux: '보조거치대', item: '유실물',
                     spawn: '그림자 스폰 지점' };

let stage = newStage(13, 9);
let tool = 'floor';
let selected = null;          // [c, r]
let pickingCells = null;      // enterCell 편집 중인 트리거
let dragPaint = null;         // 'add' | 'remove'
let mapName = 'custom1';
let cleanSnap = '';           // 마지막 저장/로드 시점의 직렬화 상태 (미저장 변경 감지)
let saveNote = '';            // 마지막 저장 결과 안내 (검증 결과 아래 표시)

const markClean = () => { cleanSnap = serialize(stage); };
const isDirty = () => serialize(stage) !== cleanSnap;
// 미저장 변경을 버리는 동작 전 확인. 변경 없으면 조용히 통과.
const confirmDiscard = () =>
  !isDirty() || confirm('저장하지 않은 변경이 있습니다. 버리고 계속할까요?');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const panel = document.getElementById('panel');

const ppc = () => Math.max(16, Math.min(52, Math.floor(1150 / stage.cols), Math.floor(880 / stage.rows)));

// ── 렌더 ──
function draw() {
  const P = ppc();
  canvas.width = stage.cols * P;
  canvas.height = stage.rows * P;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const lit = new Set(stage.litCells.map(([c, r]) => c + ',' + r));
  for (const [c, r] of stage.cells) {
    ctx.fillStyle = lit.has(c + ',' + r) ? '#efe9d2' : '#6a58d6';
    ctx.fillRect(c * P + 1, r * P + 1, P - 2, P - 2);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let c = 0; c <= stage.cols; c++) { ctx.beginPath(); ctx.moveTo(c * P, 0); ctx.lineTo(c * P, canvas.height); ctx.stroke(); }
  for (let r = 0; r <= stage.rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * P); ctx.lineTo(canvas.width, r * P); ctx.stroke(); }

  const diamond = (c, r, color, fill, label) => {
    const x = (c + 0.5) * P, y = (r + 0.5) * P, h = P * 0.32;
    ctx.beginPath();
    ctx.moveTo(x, y - h); ctx.lineTo(x + h, y); ctx.lineTo(x, y + h); ctx.lineTo(x - h, y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = color; ctx.fill(); }
    else { ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke(); }
    if (label) {
      ctx.fillStyle = '#eee'; ctx.font = `${Math.max(9, P * 0.22)}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(label, x, y - h - 3);
      ctx.textAlign = 'left';
    }
  };
  if (stage.source) diamond(...stage.source.cell, '#ffd257', true, `광원 ${stage.source.dir}`);
  if (stage.waypoint) diamond(...stage.waypoint.cell, '#c9962f', true, `중간 ${stage.waypoint.dir}`);
  if (stage.goal) diamond(...stage.goal.cell, '#6fdc6f', true, '목표');
  for (const s of stage.stands) {
    diamond(...s.cell, s.aux ? '#c9a832' : '#38c7dd', false,
            s.fixedAngle !== undefined ? `${s.id}🔒` : s.id);
  }
  for (const i of stage.items) diamond(...i.cell, '#a6caec', true, i.id);
  for (const t of stage.spawnTriggers) {
    const [c, r] = t.spawnCell, x = (c + 0.5) * ppc(), y = (r + 0.5) * ppc(), h = ppc() * 0.24;
    ctx.fillStyle = '#c33a10';
    ctx.fillRect(x - h, y - h, h * 2, h * 2);
    ctx.fillStyle = '#eee'; ctx.font = `${Math.max(9, ppc() * 0.22)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(t.id, x, y - h - 3);
    ctx.textAlign = 'left';
  }
  // enterCell 조건 칸 강조 (선택된 트리거 또는 편집 중)
  const focusTrig = pickingCells ||
    (selected && objectAt(stage, ...selected)?.kind === 'spawn' ? objectAt(stage, ...selected).obj : null);
  if (focusTrig && focusTrig.type === 'enterCell') {
    ctx.strokeStyle = '#ff8f5f'; ctx.lineWidth = 2;
    for (const [c, r] of focusTrig.cells) ctx.strokeRect(c * P + 3, r * P + 3, P - 6, P - 6);
  }
  if (selected) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(selected[0] * P + 1.5, selected[1] * P + 1.5, P - 3, P - 3);
  }
}

// ── 입력 ──
function cellOf(e) {
  const rect = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width) / ppc());
  const r = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height) / ppc());
  if (c < 0 || r < 0 || c >= stage.cols || r >= stage.rows) return null;
  return [c, r];
}

canvas.addEventListener('mousedown', (e) => {
  const cell = cellOf(e);
  if (!cell) return;
  const [c, r] = cell;
  if (pickingCells) {                       // enterCell 조건 칸 토글 모드
    if (!isFloor(stage, c, r)) return;
    const i = pickingCells.cells.findIndex(([cc, rr]) => cc === c && rr === r);
    if (i >= 0) pickingCells.cells.splice(i, 1);
    else pickingCells.cells.push([c, r]);
    refresh();
    return;
  }
  if (tool === 'floor') {
    dragPaint = isFloor(stage, c, r) ? 'remove' : 'add';
    paintFloor(c, r);
  } else if (tool === 'lit') {
    toggleLit(stage, c, r);
  } else if (tool === 'erase') {
    if (!removeObjectAt(stage, c, r) && isFloor(stage, c, r)) toggleFloor(stage, c, r);
  } else if (tool === 'select') {
    selected = cell;
  } else {
    if (placeObject(stage, tool, c, r)) selected = cell;
  }
  refresh();
});
canvas.addEventListener('mousemove', (e) => {
  if (!dragPaint) return;
  const cell = cellOf(e);
  if (cell) { paintFloor(...cell); refresh(); }
});
addEventListener('mouseup', () => { dragPaint = null; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function paintFloor(c, r) {
  const has = isFloor(stage, c, r);
  if (dragPaint === 'add' && !has) toggleFloor(stage, c, r);
  if (dragPaint === 'remove' && has) toggleFloor(stage, c, r);
}

// ── 패널 ──
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  for (const ch of children) node.append(ch);
  return node;
}
const row = (label, ...controls) =>
  el('label', {}, el('span', { className: 'k', textContent: label }), ...controls);

function buildPanel() {
  panel.innerHTML = '';
  panel.append(el('h3', { textContent: '맵 파일' }));
  const nameIn = el('input', { type: 'text', value: mapName, size: 14 });
  nameIn.onchange = () => { mapName = nameIn.value.trim(); };
  panel.append(row('이름', nameIn));

  const loadSel = el('select');
  loadSel.append(el('option', { value: '', textContent: '— 불러오기 —' }));
  for (const t of Object.keys(TEMPLATES)) loadSel.append(el('option', { value: 'tpl:' + t, textContent: `템플릿: ${t}` }));
  serverMaps().then(names => {
    const server = new Set(names || []);
    for (const n of server) loadSel.append(el('option', { value: 'map:' + n, textContent: `커스텀: ${n}` }));
    // 브라우저(localStorage)에 저장된 맵 — 서버 없는 웹 공개판 저장분
    for (const n of localMaps()) {
      if (!server.has(n)) loadSel.append(el('option', { value: 'loc:' + n, textContent: `브라우저: ${n}` }));
    }
  });
  loadSel.onchange = async () => {
    const v = loadSel.value;
    if (!v) return;
    if (!confirmDiscard()) { loadSel.value = ''; return; }
    if (v.startsWith('tpl:')) stage = deserialize(TEMPLATES[v.slice(4)]);
    else if (v.startsWith('loc:')) {
      const name = v.slice(4);
      stage = deserialize(loadLocalMap(name));
      mapName = name;
    } else {
      const name = v.slice(4);
      stage = deserialize(await (await fetch(`maps/custom/${name}.json?t=${Date.now()}`)).json());
      mapName = name;
    }
    selected = null; pickingCells = null;
    markClean();
    refresh(true);
  };
  panel.append(row('열기', loadSel));

  // 입력 순서는 일반 관례대로 행×열 — 내부 데이터(cols/rows)는 그대로. 최대 20×20.
  const MAX = 20;
  const clamp = (v) => Math.min(MAX, Math.max(1, v | 0));
  const rowsIn = el('input', { type: 'number', min: 1, max: MAX, value: stage.rows });
  const colsIn = el('input', { type: 'number', min: 1, max: MAX, value: stage.cols });
  const sizeBtn = el('button', { textContent: '크기 적용' });
  sizeBtn.onclick = () => {
    // 직접 입력이 max를 넘겨도 클램프 (number 필드 max는 스피너만 강제)
    stage.rows = clamp(rowsIn.value);
    stage.cols = clamp(colsIn.value);
    stage.cells = stage.cells.filter(([c, r]) => c < stage.cols && r < stage.rows);
    refresh(true);
  };
  panel.append(row('크기 (행×열, 최대 20)', rowsIn, colsIn, sizeBtn));

  const saveBtn = el('button', { textContent: '저장' });
  saveBtn.onclick = () => save(false);
  const playBtn = el('button', { textContent: '저장 후 플레이 ▶' });
  playBtn.onclick = () => save(true);
  const newBtn = el('button', { textContent: '새 맵' });
  newBtn.onclick = () => {
    if (!confirmDiscard()) return;
    stage = newStage(13, 9); selected = null; pickingCells = null;
    markClean();
    refresh(true);
  };
  const backBtn = el('button', { textContent: '게임으로 이동 (저장 안 함)' });
  backBtn.onclick = () => {
    if (!confirmDiscard()) return;
    location.href = './play.html';
  };
  // 공유 링크: 맵 데이터를 URL에 담는다 — 서버 없이 누구에게나 전달 가능
  const shareBtn = el('button', { textContent: '공유 링크 복사' });
  shareBtn.onclick = async () => {
    const r = validateNow();
    if (r.errors.length) { alert('검증 오류를 먼저 해결하세요:\n' + r.errors.join('\n')); return; }
    const url = new URL('./play.html', location.href).href +
                '#map=' + encodeShare(JSON.parse(serialize(stage)));
    try {
      await navigator.clipboard.writeText(url);
      shareBtn.textContent = '복사됨 ✓ — 붙여넣어 전달하세요';
    } catch {
      prompt('아래 링크를 직접 복사하세요', url);
      shareBtn.textContent = '공유 링크 복사';
    }
    setTimeout(() => { shareBtn.textContent = '공유 링크 복사'; }, 2000);
  };
  panel.append(el('div', {}, saveBtn, playBtn, newBtn, backBtn, shareBtn));
  panel.append(el('div', { id: 'report' }));

  panel.append(el('h3', { textContent: '도구' }));
  const toolsDiv = el('div', { id: 'tools' });
  for (const [group, defs] of TOOL_GROUPS) {
    toolsDiv.append(el('div', { className: 'tool-group', textContent: group }));
    const rowDiv = el('div', { className: 'tool-row' });   // 3열 그리드 (오브젝트 = 3·3·2)
    for (const [id, label] of defs) {
      const b = el('button', {
        textContent: label,
        className: (group === '편집' ? 'edit ' : '') + (tool === id ? 'on' : ''),
      });
      b.onclick = () => { tool = id; pickingCells = null; buildPanel(); draw(); };
      rowDiv.append(b);
    }
    toolsDiv.append(rowDiv);
  }
  panel.append(toolsDiv);

  panel.append(el('h3', { textContent: '조작 설명' }));
  const help = el('div', { className: 'help' });
  for (const [name, desc] of [
    ['바닥 · 밝은 칸', '드래그로 칠하기 / 다시 칠하면 지우기'],
    ['오브젝트', '바닥 칸 클릭으로 배치 (한 칸 = 한 오브젝트)'],
    ['선택', '오브젝트 클릭 → 인스펙터에서 방향·오프셋·스폰 조건 등 편집'],
    ['지우개', '클릭한 칸의 오브젝트 → 바닥 순으로 삭제'],
  ]) {
    help.append(el('div', {}, el('b', { textContent: name }), `: ${desc}`));
  }
  panel.append(help);

  buildInspector();
  validateNow();
}

function buildInspector() {
  const old = document.getElementById('inspector');
  if (old) old.remove();
  if (!selected) return;
  const hit = objectAt(stage, ...selected);
  const box = el('div', { id: 'inspector' });
  box.append(el('h3', { textContent: `선택: (${selected[0]},${selected[1]})` + (hit ? ` — ${KIND_LABEL[hit.kind]}` : ' — 비어 있음') }));
  if (!hit) { panel.append(box); return; }
  const { kind, obj } = hit;

  if (obj.id !== undefined) {
    const idIn = el('input', { type: 'text', value: obj.id, size: 8 });
    idIn.onchange = () => { renameId(kind, obj, idIn.value.trim()); refresh(); };
    box.append(row('id', idIn));
  }
  if (kind === 'source' || kind === 'waypoint') {
    const dirSel = el('select');
    for (const d of DIRS) dirSel.append(el('option', { value: d, textContent: d, selected: obj.dir === d }));
    dirSel.onchange = () => { obj.dir = dirSel.value; refresh(); };
    box.append(row('방출 방향', dirSel));
  }
  if (kind === 'lock') {
    const sel = el('select');
    for (const [label, a] of LOCK_PRESETS) {
      sel.append(el('option', { value: a, textContent: label, selected: Math.abs(obj.fixedAngle - a) < 1e-9 }));
    }
    sel.onchange = () => { obj.fixedAngle = Number(sel.value); refresh(); };
    box.append(row('고정 각', sel));
  }
  if (kind === 'item' || kind === 'spawn') {
    const keyName = kind === 'item' ? 'offset' : 'spawnOffset';
    const off = obj[keyName] || [0, 0];
    const ox = el('input', { type: 'number', step: 0.3, value: off[0] });
    const oy = el('input', { type: 'number', step: 0.3, value: off[1] });
    const apply = () => {
      const v = [Number(ox.value) || 0, Number(oy.value) || 0];
      if (v[0] === 0 && v[1] === 0) delete obj[keyName];
      else obj[keyName] = v;
      refresh();
    };
    ox.onchange = apply; oy.onchange = apply;
    box.append(row('오프셋 m (x,y)', ox, oy));
  }
  if (kind === 'spawn') buildTriggerFields(box, obj);

  const delBtn = el('button', { textContent: '삭제' });
  delBtn.onclick = () => { removeObjectAt(stage, ...selected); refresh(); };
  box.append(el('div', {}, delBtn));
  panel.append(box);
}

function buildTriggerFields(box, t) {
  const typeSel = el('select');
  for (const [v, label] of [['enterCell', '구역 진입'], ['pickupItem', '유실물 획득'], ['reachStand', '거치대 도달']]) {
    typeSel.append(el('option', { value: v, textContent: label, selected: t.type === v }));
  }
  typeSel.onchange = () => {
    t.type = typeSel.value;
    delete t.item; delete t.stand; delete t.cells;
    if (t.type === 'enterCell') t.cells = [[...t.spawnCell]];
    if (t.type === 'pickupItem') t.item = stage.items[0]?.id || '';
    if (t.type === 'reachStand') t.stand = stage.stands[0]?.id || '';
    refresh();
  };
  box.append(row('발동 조건', typeSel));

  if (t.type === 'pickupItem' || t.type === 'reachStand') {
    const pool = t.type === 'pickupItem' ? stage.items : stage.stands;
    const keyName = t.type === 'pickupItem' ? 'item' : 'stand';
    const sel = el('select');
    for (const o of pool) sel.append(el('option', { value: o.id, textContent: o.id, selected: t[keyName] === o.id }));
    sel.onchange = () => { t[keyName] = sel.value; refresh(); };
    box.append(row('대상', sel));
  }
  if (t.type === 'enterCell') {
    const pick = el('button', {
      textContent: pickingCells === t ? '진입 칸 선택 완료' : `진입 칸 편집 (${t.cells.length}개)`,
      className: pickingCells === t ? 'on' : '',
    });
    pick.onclick = () => { pickingCells = pickingCells === t ? null : t; refresh(); };
    box.append(row('진입 칸', pick));
  }
  const groupIn = el('input', { type: 'text', value: t.group || '', size: 6 });
  groupIn.onchange = () => {
    if (groupIn.value.trim()) t.group = groupIn.value.trim();
    else delete t.group;
    refresh();
  };
  box.append(row('그룹 (동시/택일 발화)', groupIn));

  const unlessSel = el('select');
  unlessSel.append(el('option', { value: '', textContent: '(없음)' }));
  for (const s of stage.stands) {
    unlessSel.append(el('option', { value: s.id, textContent: s.id, selected: t.unlessStand === s.id }));
  }
  unlessSel.onchange = () => {
    if (unlessSel.value) t.unlessStand = unlessSel.value;
    else delete t.unlessStand;
    refresh();
  };
  box.append(row('미방문 조건 거치대', unlessSel));
}

// id 변경 시 트리거 참조도 함께 갱신
function renameId(kind, obj, next) {
  if (!next || next === obj.id) return;
  const prev = obj.id;
  obj.id = next;
  for (const t of stage.spawnTriggers) {
    if (kind === 'item' && t.item === prev) t.item = next;
    if ((kind === 'stand' || kind === 'lock' || kind === 'aux')) {
      if (t.stand === prev) t.stand = next;
      if (t.unlessStand === prev) t.unlessStand = next;
    }
  }
}

// ── 검증·저장 ──
function validateNow() {
  const report = document.getElementById('report');
  if (!report) return { errors: [] };
  const r = validateStage(stage);
  report.innerHTML = '';
  for (const e of r.errors) report.append(el('div', { className: 'err', textContent: '✖ ' + e }));
  for (const wn of r.warnings) report.append(el('div', { className: 'warn', textContent: '△ ' + wn }));
  if (r.errors.length === 0) report.append(el('div', { className: 'ok', textContent: '✔ 검증 통과 — 저장 가능' }));
  if (saveNote) report.append(el('div', { className: 'ok', textContent: saveNote }));
  return r;
}

async function save(andPlay) {
  if (!mapName) { alert('맵 이름을 입력하세요'); return; }
  const r = validateNow();
  if (r.errors.length) { alert('검증 오류를 먼저 해결하세요:\n' + r.errors.join('\n')); return; }
  const data = JSON.parse(serialize(stage));
  const res = await fetch('/api/save-map', {
    method: 'POST',
    body: JSON.stringify({ name: mapName, data }),
  }).catch(() => null);
  if (res && res.ok) {
    saveNote = `✔ 서버에 저장됨: maps/custom/${mapName}.json`;
  } else {
    // 서버 없는 웹 공개판 → 브라우저(localStorage) 저장으로 대체
    if (!saveLocalMap(mapName, data)) { alert('저장 실패 — 브라우저 저장 공간을 확인하세요'); return; }
    saveNote = `✔ 브라우저에 저장됨 (이 기기 전용): ${mapName}`;
  }
  markClean();
  if (andPlay) location.href = `./play.html?stage=${encodeURIComponent(mapName)}`;
  else buildPanel();
}

function refresh(rebuildAll = false) {
  if (rebuildAll) buildPanel();
  else { buildInspector(); validateNow(); }
  draw();
}

markClean();   // 초기 빈 맵 = 깨끗한 상태
buildPanel();
draw();
