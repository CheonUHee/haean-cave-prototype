// 패널에서 펼쳐 둔 슬라이더 그룹 이름. 튜닝 값이 아니라 화면 상태라 tuning-store와 분리한다.
// 저장에 실패해도 패널은 그대로 떠야 하므로 읽기·쓰기 실패는 여기서 삼킨다.

const LS_OPEN = 'haean-proto-panel-open-v1';
const NULL_STORAGE = { getItem: () => null, setItem() {} };

const pick = (storage) =>
  storage || (typeof localStorage !== 'undefined' ? localStorage : NULL_STORAGE);

export function readOpenGroups(storage) {
  try {
    const v = JSON.parse(pick(storage).getItem(LS_OPEN) || '[]');
    return new Set(Array.isArray(v) ? v : []);
  } catch { return new Set(); }
}

export function writeOpenGroups(set, storage) {
  try { pick(storage).setItem(LS_OPEN, JSON.stringify([...set])); } catch { /* 무시 */ }
}
