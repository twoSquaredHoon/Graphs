// ── State ─────────────────────────────────────────────────────────────
let nodes = [], edges = [], selected = null, hovered = null;
let linkMode = false, linkFirst = null, cutMode = false;
let hoveredEdge = null;
let physicsOn = true;
let camX = 0, camY = 0, zoom = 1;
let dragging = null, dragOffX = 0, dragOffY = 0;
let panStart = null, camStart = null;
let searchHighlight = null;
let uid = 1;
let W, H;

const C = { purple: '#7c6fcd', blue: '#5dade2', teal: '#48c9b0', amber: '#f39c12', gray: '#888880' };
const PALETTE = [
  '#888880', '#ffffff', '#c0c0c0',
  '#5dade2', '#1a6fa8', '#a8d8f0',
  '#7c6fcd', '#4a3f8f', '#b8b0e8',
  '#48c9b0', '#1a8a72', '#a0e8d8',
  '#f39c12', '#b35a00', '#f8c880',
  '#e74c3c', '#8b0000', '#f0a0a0',
  '#2ecc71', '#1a6b3a', '#a0e8b8',
  '#e91e8c', '#8b0050', '#f0a0d0',
  '#ff6b35', '#ffd700', '#9b59b6',
];

function colorForDeg(deg) {
  if (deg === 0) return C.gray;
  if (deg <= 2)  return C.blue;
  if (deg <= 5)  return C.purple;
  if (deg <= 9)  return C.teal;
  return C.amber;
}

function nodeRadius(id) {
  const deg = edges.filter(e => e.s === id || e.t === id).length;
  return 5 + deg * 3;
}

function recolorAll() {
  nodes.forEach(n => {
    if (n.isGhost || n._customColor) return;
    n.color = colorForDeg(edges.filter(e => e.s === n.id || e.t === n.id).length);
  });
}

function addNode(wx, wy, label) {
  nodes.push({ id: uid++, x: wx, y: wy, label, color: C.purple, vx: 0, vy: 0, fx: null, fy: null, isGhost: false });
  updateStats();
}

function deleteNode(n) {
  nodes = nodes.filter(x => x.id !== n.id);
  edges = edges.filter(e => e.s !== n.id && e.t !== n.id);
  if (selected && selected.id === n.id) selected = null;
  recolorAll();
  updateStats();
}

function deleteSelected() {
  if (selected) deleteNode(selected);
}

// ── Coords ────────────────────────────────────────────────────────────
function toWorld(cx, cy) { return { x: (cx - camX) / zoom, y: (cy - camY) / zoom }; }

function getNodeAt(cx, cy) {
  const { x, y } = toWorld(cx, cy);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (Math.hypot(x - n.x, y - n.y) < nodeRadius(n.id) + 3) return n;
  }
  return null;
}

function getEdgeAt(cx, cy) {
  const { x, y } = toWorld(cx, cy);
  let best = null, bestD = 7 / zoom;
  edges.forEach(e => {
    const a = nodes.find(n => n.id === e.s), b = nodes.find(n => n.id === e.t);
    if (!a || !b) return;
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    if (!len2) return;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
    if (d < bestD) { bestD = d; best = e; }
  });
  return best;
}

// ── Physics ───────────────────────────────────────────────────────────
function tick() {
  if (!physicsOn || !nodes.length) return;
  const rep = 9000, spring = 120, damp = 0.84, dt = 0.38;
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].vx *= damp; nodes[i].vy *= damp;
    for (let j = i + 1; j < nodes.length; j++) {
      let dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) { dx = (Math.random() - .5) * 0.5; dy = (Math.random() - .5) * 0.5; }
      let d = Math.sqrt(dx * dx + dy * dy) || 1;
      const minD = nodeRadius(nodes[i].id) + nodeRadius(nodes[j].id) + 20;
      let f = rep / (d * d) + (d < minD ? (minD - d) * 2 : 0);
      let ux = dx / d, uy = dy / d;
      nodes[i].vx += ux * f * dt; nodes[i].vy += uy * f * dt;
      nodes[j].vx -= ux * f * dt; nodes[j].vy -= uy * f * dt;
    }
  }
  edges.forEach(e => {
    const a = nodes.find(n => n.id === e.s), b = nodes.find(n => n.id === e.t);
    if (!a || !b) return;
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    let f = (d - spring) * 0.1, ux = dx / d, uy = dy / d;
    a.vx += ux * f * dt; a.vy += uy * f * dt;
    b.vx -= ux * f * dt; b.vy -= uy * f * dt;
  });
  nodes.forEach(n => {
    n.vx += -n.x * 0.003 * dt; n.vy += -n.y * 0.003 * dt;
    if (n.fx !== null) { n.x = n.fx; n.y = n.fy; return; }
    const spd = Math.hypot(n.vx, n.vy);
    if (spd > 30) { n.vx = n.vx / spd * 30; n.vy = n.vy / spd * 30; }
    n.x += n.vx; n.y += n.vy;
  });
}