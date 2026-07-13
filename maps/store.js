// 서버 없는 환경(GitHub Pages 등)용 맵 보관함 — 브라우저 localStorage + URL 공유 링크.
// 로컬 개발 서버의 maps/custom/*.json이 정본이고, 이건 정적 호스팅에서의 대체 경로다.
const LS_MAPS = 'haean-proto-maps-v1';

const store = (ls) => ls || globalThis.localStorage;

function readAll(ls) {
  try { return JSON.parse(store(ls).getItem(LS_MAPS) || '{}') || {}; }
  catch { return {}; }
}

export function localMaps(ls) {
  return Object.keys(readAll(ls)).sort();
}

// 서버 저장 맵 목록 — 개발 서버(/api/maps) 우선, 정적 호스팅에선 커밋된 index.json
export async function serverMaps() {
  try {
    const r = await fetch('/api/maps');
    if (r.ok) return await r.json();
  } catch { /* 정적 호스팅 */ }
  try {
    const r = await fetch('maps/custom/index.json?t=' + Date.now());
    if (r.ok) return await r.json();
  } catch { /* 목록 파일 없음 */ }
  return [];
}

export function saveLocalMap(name, data, ls) {
  const all = readAll(ls);
  all[name] = data;
  try { store(ls).setItem(LS_MAPS, JSON.stringify(all)); return true; }
  catch { return false; }
}

export function loadLocalMap(name, ls) {
  const all = readAll(ls);
  return name in all ? all[name] : null;
}

// 맵 데이터 → URL 프래그먼트에 안전한 base64url 문자열 (유니코드 안전)
export function encodeShare(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}
