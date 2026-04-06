// ── Drag & drop vault file ────────────────────────────────────────────
document.addEventListener('dragover', e => {
  e.preventDefault();
  if (!document.getElementById('drop-overlay').classList.contains('hidden'))
    document.getElementById('drop-zone').classList.add('drag-over');
});
document.addEventListener('dragleave', e => {
  if (!e.relatedTarget) document.getElementById('drop-zone').classList.remove('drag-over');
});
document.addEventListener('drop', e => {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.md'));
  if (files.length) loadVaultFile(files[0]);
});

// ── Mouse interaction ─────────────────────────────────────────────────
const labelEl = document.getElementById('node-label');

canvas.addEventListener('mousemove', e => {
  const n = getNodeAt(e.clientX, e.clientY);
  hovered = n;
  hoveredEdge = (!n && !dragging) ? getEdgeAt(e.clientX, e.clientY) : null;
  canvas.style.cursor = hoveredEdge && cutMode ? 'crosshair' : dragging ? 'grabbing' : 'grab';
  if (n) {
    const deg = edges.filter(x => x.s === n.id || x.t === n.id).length;
    labelEl.innerHTML = `${n.label}<small>${deg} connection${deg !== 1 ? 's' : ''}${n.isGhost ? ' · unresolved ref' : ''}</small>`;
    labelEl.style.display = 'block';
    labelEl.style.left = (e.clientX + 14) + 'px';
    labelEl.style.top = (e.clientY - 28) + 'px';
  } else { labelEl.style.display = 'none'; }
  if (dragging) {
    const w = toWorld(e.clientX - dragOffX, e.clientY - dragOffY);
    dragging.fx = w.x; dragging.fy = w.y; dragging.x = w.x; dragging.y = w.y;
  } else if (panStart) {
    camX = camStart.x + (e.clientX - panStart.x);
    camY = camStart.y + (e.clientY - panStart.y);
  }
});

canvas.addEventListener('mousedown', e => {
  const n = getNodeAt(e.clientX, e.clientY);
  if (cutMode && !n && hoveredEdge) {
    edges = edges.filter(x => x !== hoveredEdge); hoveredEdge = null;
    recolorAll(); updateStats();
    cutMode = false;
    document.getElementById('btn-cut').classList.remove('active');
    return;
  }
  if (n) {
    if (e.shiftKey) {
      focusNodeId = (focusNodeId === n.id) ? null : n.id;
      return;
    }
    if (linkMode) {
      if (!linkFirst) { linkFirst = n; return; }
      if (linkFirst.id !== n.id) {
        const ex = edges.find(ee => (ee.s === linkFirst.id && ee.t === n.id) || (ee.s === n.id && ee.t === linkFirst.id));
        if (!ex) { edges.push({ s: linkFirst.id, t: n.id }); recolorAll(); updateStats(); }
        linkFirst = null;
        linkMode = false;
        document.getElementById('btn-link').classList.remove('active');
      }
      return;
    }
    selected = n;
    dragOffX = e.clientX - n.x * zoom - camX; dragOffY = e.clientY - n.y * zoom - camY;
    dragging = n; n.fx = n.x; n.fy = n.y;
  } else {
    if (editorOpen) { panStart = { x: e.clientX, y: e.clientY }; camStart = { x: camX, y: camY }; return; }
    selected = null;
    if (!editorOpen) focusNodeId = null;
    panStart = { x: e.clientX, y: e.clientY }; camStart = { x: camX, y: camY };
  }
});

canvas.addEventListener('mouseup', () => {
  if (dragging) { dragging.fx = null; dragging.fy = null; dragging = null; }
  panStart = null;
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const n = getNodeAt(e.clientX, e.clientY);
  if (n) { deleteNode(n); return; }
  const edge = getEdgeAt(e.clientX, e.clientY);
  if (edge) { edges = edges.filter(x => x !== edge); hoveredEdge = null; recolorAll(); updateStats(); }
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const f = e.deltaY < 0 ? 1.09 : 0.92;
  const wx = (e.clientX - camX) / zoom, wy = (e.clientY - camY) / zoom;
  zoom = Math.min(5, Math.max(0.04, zoom * f));
  camX = e.clientX - wx * zoom; camY = e.clientY - wy * zoom;
}, { passive: false });

// Double-click a node to edit it
canvas.addEventListener('dblclick', e => {
  const n = getNodeAt(e.clientX, e.clientY);
  if (n) openEditor(n.id);
});

// ── Keyboard ──────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA';
  if (e.key === 'Enter' && !typing && !editorOpen) {
    e.preventDefault();
    startInlineNode();
    return;
  }
  if (e.key === 'Escape') {
    if (inlineActive) { cancelInlineNode(); return; }
    linkMode = false; cutMode = false; linkFirst = null;
    ['btn-link', 'btn-cut'].forEach(id => document.getElementById(id).classList.remove('active'));
    if (editorOpen) closeEditor(false);
  }
  if (!typing && !editorOpen) {
    if (e.key === 'a' || e.key === 'A') { e.preventDefault(); toggleLinkMode(); }
    if (e.key === 'c' || e.key === 'C') { e.preventDefault(); toggleCutMode(); }
    if (e.key === 'd' || e.key === 'D') { e.preventDefault(); if (selected) deleteNode(selected); }
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !typing) deleteNode(selected);
});

// ── Inline node creation ──────────────────────────────────────────────
let inlineActive = false;
let inlineNode = null;

function startInlineNode() {
  if (inlineActive) return;
  inlineActive = true;
  const w = toWorld(W / 2, H / 2);
  const id = uid++;
  inlineNode = { id, label: '', color: C.purple, x: w.x, y: w.y, vx: 0, vy: 0, fx: w.x, fy: w.y, isGhost: false, content: '', _inline: true };
  nodes.push(inlineNode);
  positionInlineInput();
  const wrap = document.getElementById('node-input-wrap');
  const inp = document.getElementById('node-input');
  wrap.style.display = 'block';
  inp.value = '';
  inp.focus();
}

function positionInlineInput() {
  if (!inlineNode) return;
  const sx = inlineNode.x * zoom + camX;
  const sy = inlineNode.y * zoom + camY;
  const r = nodeRadius(inlineNode.id);
  const wrap = document.getElementById('node-input-wrap');
  wrap.style.left = sx + 'px';
  wrap.style.top = (sy + r * zoom + 32) + 'px';
}

function confirmInlineNode() {
  const inp = document.getElementById('node-input');
  const label = inp.value.trim();
  if (inlineNode) {
    if (label) {
      inlineNode.label = label;
      inlineNode.fx = null;
      inlineNode.fy = null;
      inlineNode._inline = false;
      nodes.forEach(n => {
        if (n === inlineNode || n.isGhost || n._inline) return;
        if (n.fx !== null && Math.hypot(n.x - inlineNode.x, n.y - inlineNode.y) < 5) {
          n.fx = null; n.fy = null;
          n.vx = (Math.random() - .5) * 2; n.vy = (Math.random() - .5) * 2;
        }
      });
      recolorAll(); updateStats();
    } else {
      nodes = nodes.filter(n => n !== inlineNode);
    }
  }
  inlineNode = null;
  inlineActive = false;
  document.getElementById('node-input-wrap').style.display = 'none';
  canvas.focus();
}

function cancelInlineNode() {
  if (inlineNode) {
    nodes = nodes.filter(n => n !== inlineNode);
    inlineNode = null;
  }
  inlineActive = false;
  document.getElementById('node-input-wrap').style.display = 'none';
  canvas.focus();
}

document.getElementById('node-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); confirmInlineNode(); }
  if (e.key === 'Escape') { e.preventDefault(); cancelInlineNode(); }
});