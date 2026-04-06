// ── Editor ────────────────────────────────────────────────────────────
let editorOpen = false, editorNodeId = null;
let focusNodeId = null;

function buildEditorSwatches(node) {
  const wrap = document.getElementById('editor-swatches');
  wrap.innerHTML = '';
  PALETTE.forEach(col => {
    const s = document.createElement('div');
    s.className = 'cswatch' + (node && node.color === col && node._customColor ? ' active' : '');
    s.style.background = col;
    s.title = col;
    s.onclick = () => {
      if (editorNodeId) {
        const n = nodes.find(x => x.id === editorNodeId);
        if (n) { n.color = col; n._customColor = true; }
      }
      wrap.querySelectorAll('.cswatch').forEach(x => x.classList.remove('active'));
      s.classList.add('active');
      document.getElementById('editor-color-reset').style.color = '#888';
    };
    wrap.appendChild(s);
  });
  const resetBtn = document.getElementById('editor-color-reset');
  resetBtn.style.color = (node && node._customColor) ? '#888' : '#444';
  resetBtn.onclick = () => {
    if (editorNodeId) {
      const n = nodes.find(x => x.id === editorNodeId);
      if (n) { n._customColor = false; recolorAll(); }
    }
    wrap.querySelectorAll('.cswatch').forEach(x => x.classList.remove('active'));
    resetBtn.style.color = '#444';
  };
}

function openEditor(nodeId) {
  editorOpen = true; editorNodeId = nodeId || null;
  focusNodeId = nodeId || null;
  const titleEl = document.getElementById('editor-title');
  const bodyEl = document.getElementById('editor-textarea');
  const n = nodeId ? nodes.find(x => x.id === nodeId) : null;
  if (n) {
    titleEl.value = n.label;
    bodyEl.value = n.content || '';
  } else {
    titleEl.value = ''; bodyEl.value = '';
  }
  buildEditorSwatches(n);
  document.getElementById('editor').classList.add('open');
  setTimeout(() => titleEl.focus(), 260);
}

function closeEditor(save) {
  const title = document.getElementById('editor-title').value.trim() || 'Untitled';
  const body = document.getElementById('editor-textarea').value;

  if (save) {
    if (editorNodeId) {
      const n = nodes.find(x => x.id === editorNodeId);
      if (n) { n.label = title; n.content = body; }
      const newLinks = extractWikilinks(body);
      newLinks.forEach(target => {
        const tgt = nodes.find(n => n.label.toLowerCase() === target.toLowerCase());
        if (tgt) {
          const ex = edges.find(e => (e.s === editorNodeId && e.t === tgt.id) || (e.s === tgt.id && e.t === editorNodeId));
          if (!ex) edges.push({ s: editorNodeId, t: tgt.id });
        }
      });
    } else {
      const angle = Math.random() * Math.PI * 2, dist = 80 + Math.random() * 120;
      const id = uid++;
      nodes.push({ id, label: title, color: C.gray, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, vx: 0, vy: 0, fx: null, fy: null, isGhost: false, content: body });
      extractWikilinks(body).forEach(target => {
        const tgt = nodes.find(n => n.label.toLowerCase() === target.toLowerCase());
        if (tgt) {
          const ex = edges.find(e => (e.s === id && e.t === tgt.id) || (e.s === tgt.id && e.t === id));
          if (!ex) edges.push({ s: id, t: tgt.id });
        }
      });
    }
    recolorAll(); updateStats();
  }

  editorOpen = false; editorNodeId = null; focusNodeId = null;
  document.getElementById('editor').classList.remove('open');
}