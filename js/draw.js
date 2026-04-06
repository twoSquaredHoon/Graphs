// ── Draw ──────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0d0a08'; ctx.fillRect(0, 0, W, H);

  // grid
  ctx.strokeStyle = 'rgba(255,220,180,0.03)'; ctx.lineWidth = 1;
  const gs = 40 * zoom, ox = ((camX % gs) + gs) % gs, oy = ((camY % gs) + gs) % gs;
  for (let x = ox; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = oy; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  if (!nodes.length) return;

  ctx.save();
  ctx.translate(camX, camY); ctx.scale(zoom, zoom);

  // Compute focus set
  const focusSet = new Set();
  if (focusNodeId) {
    focusSet.add(focusNodeId);
    edges.forEach(e => {
      if (e.s === focusNodeId) focusSet.add(e.t);
      if (e.t === focusNodeId) focusSet.add(e.s);
    });
  }

  // edges
  edges.forEach(e => {
    const a = nodes.find(n => n.id === e.s), b = nodes.find(n => n.id === e.t);
    if (!a || !b) return;
    const isEdgeDimmed = focusNodeId && !(focusSet.has(e.s) && focusSet.has(e.t));
    const hot = hovered && (hovered.id === a.id || hovered.id === b.id);
    const sel = selected && (selected.id === a.id || selected.id === b.id);
    const hov = hoveredEdge === e;
    ctx.globalAlpha = isEdgeDimmed ? 0.08 : 1;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    if (hov && cutMode)       { ctx.strokeStyle = 'rgba(180,80,60,0.9)';    ctx.lineWidth = 2.5 / zoom; }
    else if (hov)             { ctx.strokeStyle = 'rgba(200,170,130,0.85)'; ctx.lineWidth = 2 / zoom; }
    else if (hot || sel)      { ctx.strokeStyle = 'rgba(180,160,130,0.55)'; ctx.lineWidth = 1.5 / zoom; }
    else                      { ctx.strokeStyle = 'rgba(180,160,130,0.1)';  ctx.lineWidth = 0.7 / zoom; }
    ctx.stroke();
    if (hov && cutMode) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, s = 5 / zoom;
      ctx.beginPath();
      ctx.moveTo(mx - s, my - s); ctx.lineTo(mx + s, my + s);
      ctx.moveTo(mx + s, my - s); ctx.lineTo(mx - s, my + s);
      ctx.strokeStyle = 'rgba(180,80,60,0.95)'; ctx.lineWidth = 1.5 / zoom; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  // link preview
  if (linkMode && linkFirst && hovered && hovered.id !== linkFirst.id) {
    ctx.beginPath(); ctx.moveTo(linkFirst.x, linkFirst.y); ctx.lineTo(hovered.x, hovered.y);
    ctx.strokeStyle = 'rgba(160,120,72,0.7)'; ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]); ctx.stroke(); ctx.setLineDash([]);
  }

  // nodes
  nodes.forEach(n => {
    const isSel = selected && selected.id === n.id;
    const isHov = hovered && hovered.id === n.id;
    const isSearch = searchHighlight && n.label.toLowerCase().includes(searchHighlight);
    const isInline = n._inline;
    const isDimmed = focusNodeId && !focusSet.has(n.id);
    const r = nodeRadius(n.id) * (isHov || isSel ? 1.18 : 1);

    if (isSel || isHov || isSearch) {
      ctx.beginPath(); ctx.arc(n.x, n.y, r + 7 / zoom, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(n.x, n.y, r * 0.2, n.x, n.y, r + 12 / zoom);
      const col = isSearch ? C.amber : n.color;
      g.addColorStop(0, col + '66'); g.addColorStop(1, col + '00');
      ctx.fillStyle = g; ctx.fill();
    }

    ctx.globalAlpha = isDimmed ? 0.15 : isInline ? 0.85 : n.isGhost ? 0.5 : 1;
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = n.color; ctx.fill(); ctx.globalAlpha = 1;

    if (isInline) {
      ctx.beginPath(); ctx.arc(n.x, n.y, r + 5 / zoom, 0, Math.PI * 2);
      ctx.setLineDash([5 / zoom, 3 / zoom]);
      ctx.strokeStyle = 'rgba(160,120,72,0.9)'; ctx.lineWidth = 1.5 / zoom; ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = isSel ? '#fff' : isHov ? 'rgba(255,255,255,0.65)' : n.isGhost ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = (isSel ? 2 : 0.8) / zoom; ctx.stroke();
    }

    if (zoom > 0.35 || isHov || isSel || isInline) {
      const fs = Math.max(8, Math.min(13, 11 / zoom));
      ctx.font = `${isSel ? '600 ' : '400 '}${fs}px Segoe UI,sans-serif`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = n.isGhost ? 0.35 : 1;
      ctx.fillStyle = isHov || isSel ? '#e8d8c8' : 'rgba(180,160,140,0.75)';
      if (n.label) ctx.fillText(n.label, n.x, n.y + r + fs * 1.3);
      ctx.globalAlpha = 1;
    }
  });

  if (linkFirst) {
    const n = linkFirst;
    ctx.beginPath(); ctx.arc(n.x, n.y, nodeRadius(n.id) + 5 / zoom, 0, Math.PI * 2);
    ctx.strokeStyle = '#a07848'; ctx.lineWidth = 2 / zoom; ctx.stroke();
  }

  ctx.restore();
}