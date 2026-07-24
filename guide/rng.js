// 시드 고정 난수 (mulberry32) — 데모가 매 루프 같은 장면을 재현하게 한다.
// 게임 본체는 쓰지 않는다. Math.random과 같은 규약: 0 이상 1 미만.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
