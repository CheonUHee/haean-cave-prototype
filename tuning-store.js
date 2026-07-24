// 튜닝 값 3층 저장소.
//   작업값(WORKING, 조정할 때마다 자동) > 사용자 기본값(BASE, '기본값으로 저장') > 코드 기본값
// DOM도 전역 CFG도 붙들지 않는다 — 테스트가 가짜 저장소와 가짜 cfg를 넣을 수 있어야 한다.

const WORKING = 'haean-proto-cfg-v1';
const BASE = 'haean-proto-cfg-base-v1';

// localStorage가 없는 환경(노드 테스트)이나 접근이 막힌 환경(사파리 프라이빗)에서도
// 패널이 죽지 않아야 한다. 읽기·쓰기 실패는 여기서 삼킨다.
const NULL_STORAGE = { getItem: () => null, setItem() {}, removeItem() {} };

// keys: 저장 대상 키 목록 · defaults: 코드 기본값 · storage: localStorage 대역
export function createTuningStore({ keys, defaults, storage }) {
  // 계약: defaults는 keys를 모두 덮어야 한다 — 안 그러면 apply()의 `if (!src) continue`는
  // 통과하지만 빠진 키는 아무 소스에도 안 걸려 restoreBase/factoryReset이 그 키를 조용히 그대로 둔다.
  const missingDefaults = keys.filter((k) => !defaults || !(k in defaults));
  if (missingDefaults.length) {
    console.warn(`[tuning-store] defaults에 없는 키: ${missingDefaults.join(', ')}`);
  }

  const st = storage || (typeof localStorage !== 'undefined' ? localStorage : NULL_STORAGE);

  const read = (k) => {
    try {
      const raw = st.getItem(k);
      const val = raw ? JSON.parse(raw) : null;
      return val && typeof val === 'object' ? val : null;
    } catch { return null; }
  };
  const write = (k, obj) => { try { st.setItem(k, JSON.stringify(obj)); } catch { /* 무시 */ } };
  const drop = (k) => { try { st.removeItem(k); } catch { /* 무시 */ } };

  // cfg에서 저장 대상 키만 뽑는다. cfg의 다른 값이 저장소로 새어 나가지 않게 한다.
  const snapshot = (cfg) => {
    const out = {};
    for (const k of keys) out[k] = cfg[k];
    return out;
  };

  // 저장분을 cfg에 얹는다. 낮은 층부터 덮어써야 우선순위가 선다.
  const apply = (cfg, sources) => {
    for (const src of sources) {
      if (!src) continue;
      for (const k of keys) if (k in src) cfg[k] = src[k];
    }
  };

  return {
    snapshot,
    load(cfg) { apply(cfg, [read(BASE), read(WORKING)]); },
    persistWorking(cfg) { write(WORKING, snapshot(cfg)); },
    saveAsBase(cfg) { write(BASE, snapshot(cfg)); },
    // 작업값을 버리고 사용자 기본값(없으면 코드 기본값)으로 되돌린다
    restoreBase(cfg) {
      drop(WORKING);
      apply(cfg, [defaults, read(BASE)]);
    },
    // 저장분을 모두 버리고 코드 기본값으로 되돌린다
    factoryReset(cfg) {
      drop(WORKING); drop(BASE);
      apply(cfg, [defaults]);
    },
  };
}
