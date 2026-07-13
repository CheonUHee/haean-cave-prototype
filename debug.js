import { CFG } from './config.js';
import { localMaps, serverMaps } from './maps/store.js';

// [key, 라벨, min, max, step] — 'h'는 섹션 헤더
const SLIDERS = [
  ['h', '캐릭터'],
  ['dodgeDist', '회피 거리 m', 0.5, 5, 0.1],
  ['dodgeWindow', '회피 윈도 s', 0.1, 2, 0.05],
  ['dodgeCooldown', '회피 쿨 s', 0.1, 3, 0.05],
  ['h', '빛'],
  ['lightRange', '사거리 m', 5, 60, 1],
  ['lightHalfWidth', '정화 반폭 m', 0.2, 3, 0.1],
  ['snapDeg', '각도 스냅 °', 0, 20, 1],
  ['h', '어둠 패널티'],
  ['darkT1', '1단계 s', 0.5, 10, 0.1],
  ['darkT2', '2단계 s', 1, 15, 0.1],
  ['darkT3', '게임오버 s', 2, 20, 0.1],
  ['slow1', '감속1', 0.1, 1, 0.05],
  ['slow2', '감속2', 0.1, 1, 0.05],
  ['vision0', '시야0 m', 2, 20, 0.5],
  ['vision1', '시야1 m', 2, 20, 0.5],
  ['vision2', '시야2 m', 1, 20, 0.5],
  ['fogAlpha', '안개 농도', 0, 1, 0.01],
  ['h', '그림자'],
  ['shPatrolSpeed', '순찰 m/s', 0.5, 5, 0.1],
  ['shChaseSpeed', '추격 m/s', 0.5, 8, 0.1],
  ['shDashSpeed', '돌진 m/s', 1, 12, 0.5],
  ['shSightRange', '시야 반경 m', 1, 12, 0.1],
  ['shSightHalfAngle', '시야 반각 °', 10, 180, 5],
  ['shDashDelay', '돌진 대기 s', 0, 5, 0.1],
  ['shDashSafeDist', '돌진 안전거리 m', 0, 30, 1],
  ['shDashCd', '돌진 쿨 s', 1, 15, 0.5],
  ['shLightKillTime', '퇴치 시간 s', 0.5, 6, 0.1],
  ['h', '그림자 오라 (맥동)'],
  ['shAuraPatrolHz', '순찰 주기 Hz', 0.1, 4, 0.1],
  ['shAuraPatrolAlpha', '순찰 밝기', 0, 1, 0.01],
  ['shAuraPatrolRange', '순찰 범위 m', 0, 4, 0.1],
  ['shAuraChaseHz', '추적 주기 Hz', 0.1, 6, 0.1],
  ['shAuraChaseAlpha', '추적 밝기', 0, 1, 0.01],
  ['shAuraChaseRange', '추적 범위 m', 0, 4, 0.1],
];

// ── 튜닝 값 저장 (localStorage) ──
// 작업 값(LS_KEY)은 조정할 때마다 자동 저장. '기본값'은 두 층:
// 사용자가 '기본값으로 저장'한 값(LS_BASE) > 코드 기본값(config.js).
const LS_KEY = 'haean-proto-cfg-v1';
const LS_BASE = 'haean-proto-cfg-base-v1';
const CODE_DEFAULTS = { ...CFG };   // 모듈 로드 시점 = 코드 기본값
const SAVED_KEYS = () => [...SLIDERS.filter(d => d[0] !== 'h').map(d => d[0]),
                          'preset', 'spawnEnabled', 'showDebug'];

const readLS = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
};

function snapshotCfg() {
  const data = {};
  for (const k of SAVED_KEYS()) data[k] = CFG[k];
  return data;
}

function persistCfg() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(snapshotCfg())); } catch { /* 무시 */ }
}

function loadCfg() {
  for (const src of [readLS(LS_BASE), readLS(LS_KEY)]) {
    if (src) for (const [k, v] of Object.entries(src)) { if (k in CFG) CFG[k] = v; }
  }
}

function applyCfg(values) {
  for (const k of SAVED_KEYS()) CFG[k] = k in values ? values[k] : CODE_DEFAULTS[k];
}

export function buildPanel(panel, actions) {
  loadCfg();                     // 저장된 튜닝 값 복원 (최초 1회 + 기본값 복원 후 재호출 시)
  panel.innerHTML = '';
  // 스테이지 선택
  const stageH = document.createElement('h3');
  stageH.textContent = '스테이지';
  panel.appendChild(stageH);
  for (const n of [1, 2, 3]) {
    const b = document.createElement('button');
    b.textContent = `${n}단계`;
    b.onclick = () => actions.setStage(n);
    panel.appendChild(b);
  }
  // 커스텀 맵 (에디터 산출물) — 서버가 있을 때만 목록이 뜬다
  const customSel = document.createElement('select');
  customSel.appendChild(Object.assign(document.createElement('option'),
    { value: '', textContent: '커스텀 맵…' }));
  serverMaps().then(names => {
    const server = new Set(names || []);
    for (const n of server) {
      customSel.appendChild(Object.assign(document.createElement('option'), { value: n, textContent: n }));
    }
    // 브라우저(localStorage)에 저장된 맵 — 서버 없는 웹 공개판 저장분
    for (const n of localMaps()) {
      if (!server.has(n)) {
        customSel.appendChild(Object.assign(document.createElement('option'),
          { value: n, textContent: `${n} (브라우저)` }));
      }
    }
  });
  customSel.onchange = () => { if (customSel.value) actions.setCustomStage(customSel.value); };
  panel.appendChild(customSel);
  const editBtn = document.createElement('button');
  editBtn.textContent = '맵 에디터 열기';
  editBtn.onclick = () => { location.href = './editor.html'; };
  panel.appendChild(editBtn);
  // 캐릭터 프리셋
  const presetH = document.createElement('h3');
  presetH.textContent = '프리셋 (속력)';
  panel.appendChild(presetH);
  for (const name of Object.keys(CFG.presets)) {
    const l = document.createElement('label');
    const r = document.createElement('input');
    r.type = 'radio'; r.name = 'preset'; r.checked = CFG.preset === name;
    r.onchange = () => { CFG.preset = name; persistCfg(); };
    l.appendChild(r);
    l.appendChild(Object.assign(document.createElement('span'),
      { className: 'k', textContent: `${name} (${CFG.presets[name]} m/s)` }));
    panel.appendChild(l);
  }
  // 슬라이더
  for (const def of SLIDERS) {
    if (def[0] === 'h') {
      const h = document.createElement('h3'); h.textContent = def[1]; panel.appendChild(h);
      continue;
    }
    const [key, name, min, max, step] = def;
    const l = document.createElement('label');
    l.appendChild(Object.assign(document.createElement('span'), { className: 'k', textContent: name }));
    const input = Object.assign(document.createElement('input'),
      { type: 'range', min, max, step, value: CFG[key] });
    const val = Object.assign(document.createElement('span'), { className: 'v', textContent: CFG[key] });
    input.oninput = () => { CFG[key] = Number(input.value); val.textContent = input.value; persistCfg(); };
    l.appendChild(input); l.appendChild(val);
    panel.appendChild(l);
  }
  // 토글
  const togglesH = document.createElement('h3');
  togglesH.textContent = '옵션';
  panel.appendChild(togglesH);
  for (const [key, name] of [['spawnEnabled', '그림자 스폰'], ['showDebug', '디버그 표시']]) {
    const l = document.createElement('label');
    const c = Object.assign(document.createElement('input'), { type: 'checkbox', checked: CFG[key] });
    c.onchange = () => { CFG[key] = c.checked; persistCfg(); };
    l.appendChild(c);
    l.appendChild(Object.assign(document.createElement('span'), { className: 'k', textContent: name }));
    panel.appendChild(l);
  }
  // 버튼
  const btnH = document.createElement('h3');
  btnH.textContent = '제어';
  panel.appendChild(btnH);
  for (const [name, fn] of [['일시정지 (P)', actions.pause], ['1틱 진행 (1/60초)', actions.step],
                            ['세이브로 리셋 (R)', actions.reset], ['처음부터', actions.restart]]) {
    const b = document.createElement('button');
    b.textContent = name; b.onclick = fn;
    panel.appendChild(b);
  }
  // 튜닝 값 저장/복원
  const cfgH = document.createElement('h3');
  cfgH.textContent = '튜닝 값';
  panel.appendChild(cfgH);
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '기본값으로 저장';
  saveBtn.onclick = () => {
    try { localStorage.setItem(LS_BASE, JSON.stringify(snapshotCfg())); } catch { /* 무시 */ }
    saveBtn.textContent = '저장됨 ✓';
    setTimeout(() => { saveBtn.textContent = '기본값으로 저장'; }, 1500);
  };
  panel.appendChild(saveBtn);
  const resetBtn = document.createElement('button');
  resetBtn.textContent = '기본값 복원';
  resetBtn.onclick = () => {
    try { localStorage.removeItem(LS_KEY); } catch { /* 무시 */ }
    applyCfg(readLS(LS_BASE) || {});      // 저장한 기본값이 없으면 코드 기본값
    buildPanel(panel, actions);
  };
  panel.appendChild(resetBtn);
  const fileBtn = document.createElement('button');
  fileBtn.textContent = '코드 기본값으로 확정 (tuned.js)';
  fileBtn.onclick = async () => {
    let ok = false;
    try {
      const res = await fetch('/api/save-tuning', { method: 'POST', body: JSON.stringify(snapshotCfg()) });
      ok = res.ok;
    } catch { /* 서버 미지원/중단 */ }
    fileBtn.textContent = ok ? '확정됨 ✓ — git 커밋하면 다른 PC에도 적용' : '실패 — 서버(실행.bat) 확인';
    setTimeout(() => { fileBtn.textContent = '코드 기본값으로 확정 (tuned.js)'; }, 2500);
  };
  panel.appendChild(fileBtn);
  const factoryBtn = document.createElement('button');
  factoryBtn.textContent = '공장 초기화';
  factoryBtn.onclick = () => {
    try { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_BASE); } catch { /* 무시 */ }
    applyCfg({});                          // 코드 기본값(config.js)으로
    buildPanel(panel, actions);
  };
  panel.appendChild(factoryBtn);
  const helpH = document.createElement('h3');
  helpH.textContent = '조작 설명';
  panel.appendChild(helpH);
  for (const [name, desc] of [
    ['WASD / 방향키', '이동'],
    ['Shift + 방향', '회피 (2m 대시)'],
    ['E', '상호작용 — 광원·중간지점 점등/방향, 거울 배치·조정, 목표 클리어'],
    ['마우스', '(거울 조정 중) 각도 조정 · 클릭 또는 E로 확정'],
    ['P', '일시정지'],
    ['R', '마지막 저장 지점부터 다시 시작'],
  ]) {
    const d = document.createElement('div');
    d.style.cssText = 'margin:3px 0; font-size:12px; color:#9ab;';
    const b = document.createElement('b');
    b.style.color = '#7ee0ee';
    b.textContent = name;
    d.appendChild(b);
    d.appendChild(document.createTextNode(`: ${desc}`));
    panel.appendChild(d);
  }
}
