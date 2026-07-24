// 패널 숫자 표기 — 슬라이더 값과 캐릭터 속력의 자릿수를 한곳에서 정한다.

// step의 소수 자릿수만큼 채워서 찍는다. step 0.1이면 3 → "3.0", 0.01이면 0.9 → "0.90".
// 자릿수를 고정해야 값이 바뀔 때 숫자가 좌우로 흔들리지 않는다.
export function fmt(value, step) {
  const d = decimals(step);
  return d === null ? String(value) : Number(value).toFixed(d);
}

// 캐릭터 속력은 셋을 나란히 비교하는 자리라 항상 두 자리로 고정한다 (안내 페이지 표기와 동일).
export function fmtSpeed(value) {
  return Number(value).toFixed(2);
}

// 그룹별 슬라이더 개수 — SLIDERS 배열만 보면 알 수 있는 값이라 DOM 요소를 만들기 전에 미리 센다.
// (SLIDERS의 각 원소는 ['h', 그룹명, 설명] 아니면 [key, 라벨, min, max, step, 설명] — debug.js 참고)
export function countByGroup(sliders) {
  const counts = new Map();
  let cur = null;
  for (const def of sliders) {
    if (def[0] === 'h') { cur = def[1]; counts.set(cur, 0); }
    else if (cur) counts.set(cur, counts.get(cur) + 1);
  }
  return counts;
}

function decimals(step) {
  if (typeof step !== 'number' || !isFinite(step) || step <= 0) return null;
  const s = String(step);
  // JS는 절댓값이 1e-7보다 작은(정확히는 지수가 -7 이하인) 수를 String()으로 바꿀 때
  // "0.0000001"이 아니라 "1e-7" 같은 지수 표기로 만든다. indexOf('.')만 보면 점이 없어
  // 자릿수를 0으로 오판하므로, 지수 표기는 가수부 소수 자릿수에서 지수를 빼서 계산한다.
  // 예: "1e-7" → 가수부 자릿수 0 - 지수 -7 = 7. "1.5e-7" → 1 - (-7) = 8.
  const eIdx = s.search(/[eE]/);
  if (eIdx !== -1) {
    const mantissa = s.slice(0, eIdx);
    const exponent = parseInt(s.slice(eIdx + 1), 10);
    const mDot = mantissa.indexOf('.');
    const mantissaDecimals = mDot === -1 ? 0 : mantissa.length - mDot - 1;
    return Math.max(0, mantissaDecimals - exponent);
  }
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}
