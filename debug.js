import { CFG } from './config.js';
import { localMaps, serverMaps } from './maps/store.js';
import { createTuningStore } from './tuning-store.js';
import { fmt, fmtSpeed, countByGroup } from './panel-format.js';
import { readOpenGroups, writeOpenGroups } from './panel-open-store.js';

// 캐릭터 프리셋 표시용 메타. 속력은 CFG.presets가 정본이라 여기에 두지 않는다.
const CHARS = [
  { name: '스키아', heightCm: 200, face: 'assets/char-skia-face.webp' },
  { name: '감정사', heightCm: 180, face: 'assets/char-appraiser-face.webp' },
  { name: '사키리', heightCm: 120, face: 'assets/char-sakiri-face.webp' },
];

// [key, 라벨, min, max, step, 설명] — 'h'는 ['h', 그룹명, 그룹 설명]
// 설명은 슬라이더 <input>의 title로 걸린다(마우스 오버 + 스크린리더). 근거는 config.js 주석.
export const SLIDERS = [
  // 그룹명 '캐릭터'는 위의 캐릭터 카드 섹션과 겹치는데 담긴 것은 회피 셋뿐이라 '회피'로 바꾼다
  ['h', '회피', '캐릭터의 회피 관련 수치를 조정합니다.'],
  ['dodgeDist', '회피 거리 m', 0.5, 5, 0.1, '회피 한 번에 이동하는 거리'],
  ['dodgeWindow', '회피 윈도 s', 0.1, 2, 0.05,
   '[회피 윈도] 시간 내에 회피를 두 번 사용하면 쿨타임이 적용됩니다.'],
  ['dodgeCooldown', '회피 쿨 s', 0.1, 3, 0.05,
   '회피가 다시 활성화되기까지 기다려야 하는 시간'],
  ['h', '빛', '빛 궤적 관련 수치를 조정합니다.'],
  ['lightRange', '사거리 m', 5, 60, 1, '광원이나 거울에서 빛이 나아갈 수 있는 최대 거리'],
  ['lightHalfWidth', '정화 반폭 m', 0.2, 3, 0.1,
   '어둠이 걷히는 너비의 절반 길이'],
  ['snapDeg', '각도 스냅 °', 0, 20, 1,
   '빛 궤적이 수직을 이루도록 거울 각도를 자동으로 보정해주는 강도를 나타냅니다. 수치가 커질수록 보정되는 정도가 커집니다.'],
  ['h', '어둠 패널티',
   '어둠 구역에 머문 시간에 따라 부여되는 상태이상 관련 수치를 조정합니다.'],
  ['darkT1', '1단계 s', 0.5, 10, 0.1, '1단계 어둠 패널티가 적용되기까지 머물러야 하는 시간'],
  ['darkT2', '2단계 s', 1, 15, 0.1, '2단계 어둠 패널티가 적용되기까지 머물러야 하는 시간'],
  ['darkT3', '게임오버 s', 2, 20, 0.1,
   '3단계 어둠 패널티(게임 오버)가 적용되기까지 머물러야 하는 시간'],
  ['slow1', '감속1', 0.1, 1, 0.05,
   '1단계 패널티에서의 이동 속력 감속 배율 (ex. 0.75 = 기본 상태의 75%)'],
  ['slow2', '감속2', 0.1, 1, 0.05,
   '2단계 패널티에서의 이동 속력 감속 배율 (ex. 0.50 = 기본 상태의 50%)'],
  ['vision0', '시야0 m', 2, 20, 0.5, '패널티가 없을 때의 시야 반경'],
  ['vision1', '시야1 m', 2, 20, 0.5, '1단계 패널티에서의 시야 반경'],
  ['vision2', '시야2 m', 1, 20, 0.5, '2단계 패널티에서의 시야 반경'],
  ['fogAlpha', '안개 농도', 0, 1, 0.01,
   '어둠 구역을 덮는 안개의 진하기. 0에 가까울수록 맵이 밝아지고, 1에 가까울수록 맵이 어두워집니다.'],
  ['h', '그림자',
   '그림자의 상태별 속력·색적 범위·돌진 조건·퇴치 조건 관련 수치를 조정합니다.'],
  ['shPatrolSpeed', '순찰 m/s', 0.5, 5, 0.1, '플레이어를 발견하지 못한 상태일 때의 속력.'],
  ['shChaseSpeed', '추격 m/s', 0.5, 8, 0.1, '플레이어를 발견한 상태일 때의 속력'],
  ['shDashSpeed', '돌진 m/s', 1, 12, 0.5, '돌진할 때의 속력'],
  ['shSightRange', '시야 반경 m', 1, 12, 0.1, '그림자가 플레이어를 발견할 수 있는 최대 거리'],
  ['shSightHalfAngle', '시야 반각 °', 10, 180, 5,
   '시야 범위(부채꼴)의 반각. 수치가 45이면, 좌우를 합쳐 90° 범위를 봅니다.'],
  ['shDashDelay', '돌진 대기 s', 0, 5, 0.1,
   '플레이어 발견 후 [돌진]을 발동하기까지 기다려야 하는 시간'],
  ['shDashSafeDist', '돌진 안전거리 m', 0, 30, 1,
   '그림자와 안전지대까지의 거리가 해당 수치보다 작으면 돌진하지 않습니다.'],
  ['shDashCd', '돌진 쿨 s', 1, 15, 0.5,
   '돌진 시전 후, 돌진이 다시 활성화되기까지 기다려야 하는 시간'],
  ['shLightKillTime', '퇴치 시간 s', 0.5, 6, 0.1,
   '그림자를 소멸시키기 위해 빛을 지속적으로 맞혀야 하는 시간'],
  ['h', '그림자 상태 표시',
   '그림자의 상태를 나타내는 알림 표시 관련 수치를 조정합니다.'],
  ['shAuraPatrolHz', '순찰 주기 Hz', 0.1, 4, 0.1, '1초 동안 순찰 상태 표시가 반복되는 횟수'],
  ['shAuraPatrolAlpha', '순찰 밝기', 0, 1, 0.01,
   '순찰 상태 표시의 밝기 정도. 0에 가까울수록 어두워지고, 1에 가까울수록 밝아집니다.'],
  ['shAuraPatrolRange', '순찰 범위 m', 0, 4, 0.1, '순찰 상태 표시가 나타나는 반경'],
  ['shAuraChaseHz', '추적 주기 Hz', 0.1, 6, 0.1, '1초 동안 추격 상태 표시가 반복되는 횟수'],
  ['shAuraChaseAlpha', '추적 밝기', 0, 1, 0.01,
   '추적 상태 표시의 밝기 정도. 0에 가까울수록 어두워지고, 1에 가까울수록 밝아집니다.'],
  ['shAuraChaseRange', '추적 범위 m', 0, 4, 0.1, '추격 상태 표시가 나타나는 반경'],
];

// 저장 대상 = 슬라이더 전부 + 프리셋·토글. 슬라이더를 추가하면 저장 대상도 자동으로 따라온다.
const SAVED_KEYS = [...SLIDERS.filter(d => d[0] !== 'h').map(d => d[0]),
                    'preset', 'spawnEnabled', 'showDebug'];
const CODE_DEFAULTS = {};                       // 모듈 로드 시점 = 코드 기본값
for (const k of SAVED_KEYS) CODE_DEFAULTS[k] = CFG[k];

const store = createTuningStore({ keys: SAVED_KEYS, defaults: CODE_DEFAULTS });

export function buildPanel(panel, actions) {
  store.load(CFG);               // 저장된 튜닝 값 복원 (최초 1회 + 기본값 복원 후 재호출 시)
  panel.innerHTML = '';
  // 헤더 탭으로 규칙을 건너뛰고 바로 들어온 방문자를 위한 안내 (안내 페이지로 돌아갈 길)
  const guideBox = document.createElement('div');
  guideBox.className = 'guide-hint';
  guideBox.innerHTML =
    '<a class="guide-btn" href="./index.html#rules">📖 처음이신가요? 게임 규칙·조작법 보기</a>' +
    '<div>⚠ 현재 기획 의도에 맞게 값이 설정된 상태입니다.<br>' +
    '첫 플레이는 기본 상태로 해보시길 권장합니다.</div>';
  panel.appendChild(guideBox);
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
  // 캐릭터 — 얼굴 카드로 고른다. 라디오 버튼을 없앤 대신 ARIA로 같은 의미를 남긴다.
  const charH = document.createElement('h3');
  charH.textContent = '캐릭터';
  panel.appendChild(charH);
  const charRow = document.createElement('div');
  charRow.className = 'char-row';
  charRow.setAttribute('role', 'radiogroup');
  charRow.setAttribute('aria-label', '캐릭터 선택');
  const cards = [];
  CHARS.forEach((c, i) => {
    const speed = CFG.presets[c.name];
    if (speed === undefined) return;            // config.js에 없는 캐릭터는 건너뛴다
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'char-card';
    card.setAttribute('role', 'radio');
    card.innerHTML =
      `<img src="${c.face}" alt="" width="56" height="56">` +
      `<span class="cc-name"></span>` +
      `<span class="cc-stat"></span>`;
    card.querySelector('.cc-name').textContent = c.name;
    card.querySelector('.cc-stat').textContent = `${c.heightCm}cm · ${fmtSpeed(speed)} m/s`;
    const select = () => {
      CFG.preset = c.name;
      store.persistWorking(CFG);
      sync();
      card.focus();
    };
    card.onclick = select;
    // 라디오 그룹 관례: 좌우 화살표로 이동하며 곧바로 선택된다
    card.onkeydown = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      cards[(i + step + cards.length) % cards.length].select();
    };
    // DOM 요소에 상태를 얹지 않는다: 이름·선택 함수는 배열에 데이터로 둔다
    cards.push({ el: card, name: c.name, select });
    charRow.appendChild(card);
  });
  // 선택 상태를 카드 전체에 다시 칠한다. 초점은 선택된 카드 하나만 받는다(roving tabindex).
  function sync() {
    for (const c of cards) {
      const on = c.name === CFG.preset;
      c.el.classList.toggle('on', on);
      c.el.setAttribute('aria-checked', String(on));
      c.el.tabIndex = on ? 0 : -1;
    }
  }
  sync();
  panel.appendChild(charRow);
  // 조작 설명 — 규칙을 다 읽고 이제 해볼 사람에게 필요한 정보라 캐릭터 바로 아래 둔다.
  // 접지 않고 항상 펼쳐 둔다.
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
    d.className = 'help-row';
    const b = document.createElement('b');
    b.textContent = name;
    d.appendChild(b);
    d.appendChild(document.createTextNode(`: ${desc}`));
    panel.appendChild(d);
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
  // 토글
  const togglesH = document.createElement('h3');
  togglesH.textContent = '옵션';
  panel.appendChild(togglesH);
  for (const [key, name] of [['spawnEnabled', '그림자 스폰'], ['showDebug', '디버그 표시']]) {
    const l = document.createElement('label');
    const c = Object.assign(document.createElement('input'), { type: 'checkbox', checked: CFG[key] });
    c.onchange = () => { CFG[key] = c.checked; store.persistWorking(CFG); };
    l.appendChild(c);
    l.appendChild(Object.assign(document.createElement('span'), { className: 'k', textContent: name }));
    panel.appendChild(l);
  }
  // 튜닝 값 저장/복원
  const cfgH = document.createElement('h3');
  cfgH.textContent = '튜닝 값';
  panel.appendChild(cfgH);
  // 저장 버튼 — 작업값·사용자 기본값·코드 기본값 3층을 구별하려면 설명이 있어야 한다.
  const addAction = (label, desc, onclick) => {
    const b = document.createElement('button');
    b.className = 'act-btn';
    b.textContent = label;
    b.onclick = () => onclick(b);
    panel.appendChild(b);
    const d = document.createElement('div');
    d.className = 'act-desc';
    d.textContent = desc;
    panel.appendChild(d);
    return b;
  };

  addAction('기본값으로 저장', '현재 설정된 값을 이 브라우저의 기본값으로 저장', (b) => {
    store.saveAsBase(CFG);
    b.textContent = '저장됨 ✓';
    setTimeout(() => { b.textContent = '기본값으로 저장'; }, 1500);
  });

  addAction('기본값 복원', '마지막으로 저장한 기본값으로 복원', () => {
    store.restoreBase(CFG);
    buildPanel(panel, actions);
  });

  addAction('코드 기본값으로 확정',
    '현재 값을 게임 파일(tuned.js)에 기록해 이 프로토타입의 시작값으로 만듭니다. ' +
    '프로젝트 파일을 내려받아 직접 실행한 경우에만 동작하며, 링크를 통해 접속한 경우에는 ' +
    '동작하지 않습니다.',
    async (b) => {
      let ok = false;
      try {
        const res = await fetch('/api/save-tuning',
          { method: 'POST', body: JSON.stringify(store.snapshot(CFG)) });
        ok = res.ok;
      } catch { /* 서버 미지원/중단 */ }
      b.textContent = ok ? '확정됨 ✓ — git 커밋하면 다른 PC에도 적용' : '실패 — 직접 실행했는지 확인';
      setTimeout(() => { b.textContent = '코드 기본값으로 확정'; }, 2500);
    });

  addAction('공장 초기화', '저장한 값을 모두 지우고 초기 버전으로 복원', () => {
    store.factoryReset(CFG);
    buildPanel(panel, actions);
  });
  // 슬라이더 힌트 — 그룹을 펼치기 전에도 보이도록 그룹들 바로 위에 둔다.
  const slHint = document.createElement('div');
  slHint.className = 'sl-hint';
  slHint.textContent = '💡 그룹을 펼친 뒤 각 슬라이더에 마우스를 올리면 상세 설명이 표시됩니다.';
  panel.appendChild(slHint);
  // 슬라이더 — 그룹별 <details>. 네이티브 요소라 키보드·스크린리더가 그대로 따라온다.
  // 펼침 상태는 새로고침해도 기억된다 — 밸런스 작업 중 매번 다시 펼치는 일이 없도록.
  const openGroups = readOpenGroups();
  const groupCounts = countByGroup(SLIDERS);
  let group = null, body = null;
  const flush = () => { if (group) panel.appendChild(group); };
  for (const def of SLIDERS) {
    if (def[0] === 'h') {
      flush();
      group = document.createElement('details');
      group.className = 'sl-group';
      group.open = openGroups.has(def[1]);
      const sum = document.createElement('summary');
      sum.textContent = def[1];
      const count = document.createElement('span');
      count.className = 'sl-count';
      count.textContent = groupCounts.get(def[1]);
      sum.appendChild(count);
      group.appendChild(sum);
      body = document.createElement('div');
      // 그룹 설명 — 펼치면 항상 보인다. 펼친 사람은 이미 궁금해서 연 것이다.
      if (def[2]) {
        const gd = document.createElement('div');
        gd.className = 'sl-groupdesc';
        gd.textContent = def[2];
        body.appendChild(gd);
      }
      group.appendChild(body);
      // g·name을 const로 붙잡는다. 바깥의 group은 다음 헤더에서 재할당되므로
      // 핸들러 안에서 group을 읽으면 마지막 그룹을 가리킨다.
      const g = group, name = def[1];
      g.ontoggle = () => {
        if (g.open) openGroups.add(name); else openGroups.delete(name);
        writeOpenGroups(openGroups);
      };
      continue;
    }
    const [key, name, min, max, step, desc] = def;
    const l = document.createElement('label');
    l.appendChild(Object.assign(document.createElement('span'), { className: 'k', textContent: name }));
    const input = Object.assign(document.createElement('input'),
      { type: 'range', min, max, step, value: CFG[key] });
    // 라벨이 아니라 입력 요소에 건다 — 마우스 오버뿐 아니라 스크린리더가 값의 설명으로 읽는다
    if (desc) input.title = desc;
    const val = Object.assign(document.createElement('span'),
      { className: 'v', textContent: fmt(CFG[key], step) });
    input.oninput = () => {
      CFG[key] = Number(input.value);
      val.textContent = fmt(CFG[key], step);
      store.persistWorking(CFG);
    };
    l.appendChild(input); l.appendChild(val);
    body.appendChild(l);
  }
  flush();
}
