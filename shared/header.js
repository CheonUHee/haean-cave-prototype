// 공통 탭 헤더 — 각 페이지가 <script src="…/header.js" data-active="guide|play|editor" defer></script>로 로드.
// defer 실행 시점에도 document.currentScript가 유효하다.
(function () {
  const active = (document.currentScript && document.currentScript.dataset.active) || '';
  const TABS = [
    ['guide', '사이트 안내', 'index.html'],
    ['play', '테스트 플레이', 'play.html'],
    ['editor', '맵 에디터', 'editor.html'],
  ];
  const style = document.createElement('style');
  style.textContent = [
    '#site-header { display:flex; align-items:center; gap:14px; background:#1d1d30;',
    '  border-radius:6px; padding:8px 14px; flex-shrink:0; }',
    '#site-header .logo { color:#7ee0ee; font-weight:bold; font-size:15px; }',
    '#site-header nav { display:flex; gap:6px; margin-left:auto; }',
    '#site-header a { color:#ddd; text-decoration:none; padding:4px 12px; border-radius:4px;',
    '  background:#2c2c4a; border:1px solid #444; font-size:13px; }',
    '#site-header a:hover { background:#3a3a60; }',
    '#site-header a.on { background:#7ee0ee; color:#141420; border-color:#7ee0ee; font-weight:bold; }',
  ].join('\n');
  document.head.appendChild(style);
  const el = document.createElement('header');
  el.id = 'site-header';
  el.innerHTML = '<span class="logo">해안 동굴</span><nav>' +
    TABS.map(([id, name, href]) =>
      '<a href="' + href + '"' + (id === active ? ' class="on" aria-current="page"' : '') + '>' + name + '</a>').join('') +
    '</nav>';
  document.body.prepend(el);
})();
