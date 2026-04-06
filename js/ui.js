// ── UI helpers ────────────────────────────────────────────────────────
function updateStats() {
  document.getElementById('stat-nodes').textContent = nodes.filter(n => !n.isGhost).length;
  document.getElementById('stat-edges').textContent = edges.length;
}

function showUI() {
  document.getElementById('drop-overlay').classList.add('hidden');
  document.getElementById('toolbar').style.display = 'flex';
  document.getElementById('search-wrap').style.display = 'flex';
  document.getElementById('stats').style.display = 'block';
  document.getElementById('legend').style.display = 'block';
  const info = document.getElementById('info');
  info.style.display = 'block';
  info.textContent = 'Drag to pan · Scroll to zoom · Double-click node to edit · Right-click to delete';
}

function startFresh() {
  nodes = []; edges = []; uid = 1;
  vaultFilename = 'vault.md';
  showUI();
  resetView();
  updateStats();
  setTimeout(() => startInlineNode(), 50);
}

// ── Toolbar actions ───────────────────────────────────────────────────
function toggleLinkMode() {
  linkMode = !linkMode; linkFirst = null;
  document.getElementById('btn-link').classList.toggle('active', linkMode);
}

function toggleCutMode() {
  cutMode = !cutMode;
  document.getElementById('btn-cut').classList.toggle('active', cutMode);
}

function togglePhysics() {
  physicsOn = !physicsOn;
  document.getElementById('btn-phys').textContent = physicsOn ? '⚡ Physics' : '⏸ Paused';
}

function resetView() {
  zoom = 1; camX = W / 2; camY = H / 2;
}

function searchNodes(v) {
  searchHighlight = v.trim().toLowerCase() || null;
}