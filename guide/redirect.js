// 옛 공유 링크 호환: index.html?stage=… / index.html#map=… → play.html로 그대로 전달.
// classic script — 안내 페이지 head에서 블로킹 실행되어 첫 그리기 전에 이동한다.
function redirectTarget(search, hash) {
  if (/[?&]stage=/.test(search) || /^#map=/.test(hash)) return 'play.html' + search + hash;
  return null;
}
if (typeof location !== 'undefined') {
  var __target = redirectTarget(location.search, location.hash);
  if (__target) location.replace(__target);
}
