import { CELL, SUB } from './grid.js';
import { distToSeg, mirrorVectors } from './lights.js';
import { inSafeZone, safeZones, isSafeAt } from './objects.js';

export const PPM = 14;   // pixels per meter

export function setupCanvas(canvas, stage) {
  canvas.width = stage.cols * CELL * PPM;
  canvas.height = stage.rows * CELL * PPM;
  return canvas.getContext('2d');
}

const px = (m) => m * PPM;

export function draw(ctx, state) {
  const { w, player, darknessInfo, toasts, gameState, cfg, adjustStand, statsText } = state;
  const { stage } = w;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // ── 바닥 칸 ──
  for (const [c, r] of stage.cells) {
    const lit = w.litCells.has(c + ',' + r);
    ctx.fillStyle = lit ? '#efe9d2' : '#6a58d6';
    ctx.fillRect(px(c * CELL) + 1, px(r * CELL) + 1, px(CELL) - 2, px(CELL) - 2);
  }
  // 안전지대 표시
  for (const z of safeZones(w)) {
    ctx.fillStyle = 'rgba(255,240,180,0.35)';
    ctx.fillRect(px(z.x - cfg.safeHalf), px(z.y - cfg.safeHalf),
                 px(cfg.safeHalf * 2), px(cfg.safeHalf * 2));
  }

  // ── 빛 궤적 (정화 폭 + 코어) ──
  for (const s of w.light.segs) {
    ctx.strokeStyle = 'rgba(255,220,90,0.30)';
    ctx.lineWidth = px(cfg.lightHalfWidth * 2);
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(px(s.x1), px(s.y1)); ctx.lineTo(px(s.x2), px(s.y2)); ctx.stroke();
    ctx.strokeStyle = s.end === 'blocked' ? 'rgba(255,120,80,0.9)' : 'rgba(255,230,120,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(px(s.x1), px(s.y1)); ctx.lineTo(px(s.x2), px(s.y2)); ctx.stroke();
  }

  // ── 오브젝트 ──
  drawDiamond(ctx, w.source.x, w.source.y, w.source.on ? '#ffd257' : '#8d7723',
              w.source.on ? '광원' : '광원(E로 점등)');
  if (w.waypoint) {
    drawDiamond(ctx, w.waypoint.x, w.waypoint.y, w.waypoint.active ? '#ffd257' : '#8d7723',
                !w.waypoint.active ? '중간'
                : w.waypoint.on ? '중간(활성)' : '중간(E로 점등)');
  }
  // 목표 (깃발)
  ctx.fillStyle = w.goal.lit ? '#6fdc6f' : '#2e6b2e';
  ctx.beginPath();
  ctx.moveTo(px(w.goal.x) - 8, px(w.goal.y) + 10);
  ctx.lineTo(px(w.goal.x) - 8, px(w.goal.y) - 12);
  ctx.lineTo(px(w.goal.x) + 10, px(w.goal.y) - 5);
  ctx.closePath(); ctx.fill();
  label(ctx, w.goal.x, w.goal.y + 1.6, w.goal.lit ? '목표(점등)' : '목표');

  for (const st of w.stands) {
    const color = st.aux ? '#c9a832' : '#38c7dd';
    drawDiamondOutline(ctx, st.x, st.y, color, st === adjustStand);
    if (st.fixedAngle !== undefined) label(ctx, st.x + 1.1, st.y + 1.1, '🔒');
    label(ctx, st.x, st.y - 1.4, st.id);
    if (st.mirror) {
      const { ux, uy, nx, ny } = mirrorVectors(st.mirror.angle);
      const h = cfg.mirrorHalfLen, b = 0.22;
      // 뒷면 백킹 (반사 없음) — 법선 반대쪽에 어두운 판
      ctx.strokeStyle = '#4a4162'; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(px(st.x - ux * h - nx * b), px(st.y - uy * h - ny * b));
      ctx.lineTo(px(st.x + ux * h - nx * b), px(st.y + uy * h - ny * b));
      ctx.stroke();
      // 거울면 (반사) — 밝은 면
      ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px(st.x - ux * h), px(st.y - uy * h));
      ctx.lineTo(px(st.x + ux * h), px(st.y + uy * h));
      ctx.stroke();
      ctx.strokeStyle = '#7ee0ee'; ctx.lineWidth = 1.5;    // 앞면 법선 틱
      ctx.beginPath();
      ctx.moveTo(px(st.x), px(st.y));
      ctx.lineTo(px(st.x + nx * 0.7), px(st.y + ny * 0.7));
      ctx.stroke();
    }
  }
  // ── 그림자 ──
  for (const sh of w.shadows) {
    if (sh.dead) continue;
    const alpha = sh.state === 'dying' ? Math.max(0, 1 - sh.dieT) : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#17111f';
    ctx.beginPath(); ctx.arc(px(sh.x), px(sh.y), px(cfg.shRadius), 0, 7); ctx.fill();
    ctx.fillStyle = sh.state === 'telegraph' ? '#ff5f8f'
                  : sh.state === 'dash' ? '#ff2f5f'
                  : sh.state === 'chase' ? '#c05fff' : '#7f4fbf';
    ctx.beginPath(); ctx.arc(px(sh.x), px(sh.y), px(0.18), 0, 7); ctx.fill();
    if (cfg.showDebug && (sh.state === 'patrol' || sh.state === 'chase')) {
      // 시야 콘
      const a0 = Math.atan2(sh.fy, sh.fx);
      const half = (cfg.shSightHalfAngle * Math.PI) / 180;
      ctx.fillStyle = 'rgba(120,220,255,0.10)';
      ctx.beginPath(); ctx.moveTo(px(sh.x), px(sh.y));
      ctx.arc(px(sh.x), px(sh.y), px(cfg.shSightRange), a0 - half, a0 + half);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── 플레이어 ──
  ctx.fillStyle = '#f4f4f8';
  ctx.beginPath(); ctx.arc(px(player.x), px(player.y), px(cfg.playerRadius), 0, 7); ctx.fill();
  ctx.strokeStyle = '#f4f4f8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px(player.x), px(player.y));
  ctx.lineTo(px(player.x + player.fx * 0.8), px(player.y + player.fy * 0.8)); ctx.stroke();

  // ── 안개: 정화되지 않은 어둠 서브칸을 덮고, 플레이어 시야 원을 뚫는다 ──
  drawFog(ctx, state);

  // ── 유실물: 어둠 너머에서도 흐릿하게 빛난다 (안개 위에 글로우 — 스펙 §8) ──
  for (const it of w.items) {
    if (it.taken) continue;
    const pulse = 0.7 + 0.3 * Math.sin(state.simTime * 2.2);
    const gl = ctx.createRadialGradient(px(it.x), px(it.y), 0, px(it.x), px(it.y), px(1.7));
    gl.addColorStop(0, `rgba(166,202,236,${(0.55 * pulse).toFixed(3)})`);
    gl.addColorStop(1, 'rgba(166,202,236,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(px(it.x), px(it.y), px(1.7), 0, 7); ctx.fill();
    drawDiamond(ctx, it.x, it.y, '#a6caec', '유실물');
  }

  // ── 그림자 오라: 순찰 = 미약한 보랏빛 맥동 / 추적 = 더 밝고 잦은 맥동 (안개 위) ──
  for (const sh of w.shadows) {
    if (sh.dead) continue;
    const engaged = ['chase', 'telegraph', 'dash'].includes(sh.state);
    const hz = engaged ? cfg.shAuraChaseHz : cfg.shAuraPatrolHz;
    const base = engaged ? cfg.shAuraChaseAlpha : cfg.shAuraPatrolAlpha;
    const alive = sh.state === 'dying' ? Math.max(0, 1 - sh.dieT) : 1;
    const a = base * (0.65 + 0.35 * Math.sin(state.simTime * hz * Math.PI * 2)) * alive;
    const rad = cfg.shRadius + (engaged ? cfg.shAuraChaseRange : cfg.shAuraPatrolRange);
    const gl = ctx.createRadialGradient(px(sh.x), px(sh.y), px(cfg.shRadius * 0.4),
                                        px(sh.x), px(sh.y), px(rad));
    gl.addColorStop(0, `rgba(178,102,255,${a.toFixed(3)})`);
    gl.addColorStop(1, 'rgba(178,102,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(px(sh.x), px(sh.y), px(rad), 0, 7); ctx.fill();
  }

  // ── HUD·토스트: 대형 맵에서 캔버스가 CSS로 축소되어도 화면상 크기 유지 ──
  // 캔버스 픽셀폭 / 실제 표시폭 = 축소 배율. 그만큼 확대해 그리면 화면 크기가 일정하다.
  const rect = ctx.canvas.getBoundingClientRect ? ctx.canvas.getBoundingClientRect() : null;
  const ui = rect && rect.width > 0 ? ctx.canvas.width / rect.width : 1;
  const uiW = ctx.canvas.width / ui;             // 확대 좌표계에서의 화면 폭
  ctx.save();
  ctx.scale(ui, ui);
  drawHud(ctx, state);
  // 토스트
  let ty = 30;
  ctx.font = '14px sans-serif';
  for (const t of toasts) {
    ctx.fillStyle = 'rgba(20,20,34,0.85)';
    const wd = ctx.measureText(t.text).width + 20;
    ctx.fillRect(uiW / 2 - wd / 2, ty - 18, wd, 26);
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, uiW / 2, ty);
    ctx.textAlign = 'left';
    ty += 32;
  }
  ctx.restore();
  // 게임오버/클리어 오버레이
  if (gameState === 'over' || gameState === 'clear') {
    ctx.fillStyle = 'rgba(8,8,16,0.72)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = gameState === 'over' ? '#ff6f8f' : '#8fe98f';
    ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(gameState === 'over' ? '게임 오버 — R 키로 마지막 저장 지점부터' : '클리어!',
                 ctx.canvas.width / 2, ctx.canvas.height / 2 - 10);
    ctx.font = '16px sans-serif'; ctx.fillStyle = '#ddd';
    ctx.fillText(statsText, ctx.canvas.width / 2, ctx.canvas.height / 2 + 28);
    ctx.textAlign = 'left';
  }
}

let fogCanvas = null;   // 오프스크린 안개 레이어 (재사용)

function drawFog(ctx, state) {
  const { w, player, darknessInfo, cfg } = state;
  const { stage } = w;
  // 안개는 오프스크린 캔버스에 그리고 거기서만 시야 원을 뚫는다.
  // (메인 캔버스에 직접 destination-out을 쓰면 바닥·빛·오브젝트까지 지워져
  //  플레이어 주변이 검게 보인다)
  if (!fogCanvas || fogCanvas.width !== ctx.canvas.width || fogCanvas.height !== ctx.canvas.height) {
    fogCanvas = document.createElement('canvas');
    fogCanvas.width = ctx.canvas.width;
    fogCanvas.height = ctx.canvas.height;
  }
  const f = fogCanvas.getContext('2d');
  f.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
  f.fillStyle = `rgba(6,4,14,${cfg.fogAlpha})`;
  f.beginPath();
  for (const [c, r] of stage.cells) {
    if (w.litCells.has(c + ',' + r)) continue;
    for (let sr = 0; sr < 5; sr++) for (let sc = 0; sc < 5; sc++) {
      const cx = c * CELL + sc * SUB + SUB / 2, cy = r * CELL + sr * SUB + SUB / 2;
      if (inSafeZone(w, cx, cy)) continue;
      if (w.light.segs.some(s => distToSeg(cx, cy, s) <= cfg.lightHalfWidth)) continue;
      f.rect(px(c * CELL + sc * SUB), px(r * CELL + sr * SUB), px(SUB), px(SUB));
    }
  }
  f.fill();
  // 플레이어 시야 원 (어둠 단계에 따라 축소) — 안개 레이어만 뚫는다
  const vr = darknessInfo.stage >= 2 ? cfg.vision2 : darknessInfo.stage === 1 ? cfg.vision1 : cfg.vision0;
  f.globalCompositeOperation = 'destination-out';
  const g = f.createRadialGradient(px(player.x), px(player.y), px(vr * 0.45),
                                   px(player.x), px(player.y), px(vr));
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  f.fillStyle = g;
  f.beginPath(); f.arc(px(player.x), px(player.y), px(vr), 0, 7); f.fill();
  f.globalCompositeOperation = 'source-over';
  ctx.drawImage(fogCanvas, 0, 0);
}

function drawHud(ctx, state) {
  const { w, player, darknessInfo, cfg, simTime, deaths, stageId } = state;
  ctx.fillStyle = 'rgba(14,14,26,0.8)';
  ctx.fillRect(6, 6, 250, cfg.showDebug ? 96 : 44);
  ctx.fillStyle = '#cfe';
  ctx.font = '12px monospace';
  const safe = isSafeAt(w, player.x, player.y);
  const stageLabel = typeof stageId === 'number' ? `${stageId}단계` : stageId;   // 커스텀 맵은 이름 그대로
  ctx.fillText(`${stageLabel} | ${cfg.preset} | 어둠 ${safe ? '-' : darknessInfo.t.toFixed(1) + 's'} (단계 ${safe ? '-' : darknessInfo.stage})`, 14, 24);
  ctx.fillText(`시간 ${simTime.toFixed(1)}s  사망 ${deaths}`, 14, 40);
  if (cfg.showDebug) {
    const nearSafe = Math.min(...safeZones(w).map(z => Math.hypot(player.x - z.x, player.y - z.y)));
    ctx.fillText(`속력계수 ${darknessInfo.speed}  안전지대 ${nearSafe.toFixed(1)}m`, 14, 56);
    ctx.fillText(`빛 세그 ${w.light.segs.length}  그림자 ${w.shadows.filter(s => !s.dead).length}`, 14, 72);
    const wp = w.waypoint ? (w.waypoint.active ? '활성' : '비활성') : '없음';
    ctx.fillText(`중간지점 ${wp}  목표 ${w.goal.lit ? '점등' : '소등'}`, 14, 88);
  }
}

function drawDiamond(ctx, x, y, color, text) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(px(x), px(y) - 11); ctx.lineTo(px(x) + 11, px(y));
  ctx.lineTo(px(x), px(y) + 11); ctx.lineTo(px(x) - 11, px(y));
  ctx.closePath(); ctx.fill();
  if (text) label(ctx, x, y - 1.3, text);
}

function drawDiamondOutline(ctx, x, y, color, highlight) {
  ctx.strokeStyle = color;
  ctx.lineWidth = highlight ? 4 : 2;
  ctx.beginPath();
  ctx.moveTo(px(x), px(y) - 13); ctx.lineTo(px(x) + 13, px(y));
  ctx.lineTo(px(x), px(y) + 13); ctx.lineTo(px(x) - 13, px(y));
  ctx.closePath(); ctx.stroke();
}

function label(ctx, x, y, text) {
  ctx.fillStyle = '#eee';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, px(x), px(y));
  ctx.textAlign = 'left';
}
