// ── Markdown parsing ──────────────────────────────────────────────────
function extractWikilinks(text) {
  const re = /\[\[([^\]|#\n]+?)(?:\|[^\]]+?)?\]\]/g;
  const out = new Set(); let m;
  while ((m = re.exec(text)) !== null) out.add(m[1].trim());
  return out;
}

// ── Single vault file I/O ─────────────────────────────────────────────
// Format:
//   ## Node: Title
//   links: [[A]], [[B]]
//   color: #hexcolor
//
//   Body text with optional [[wikilinks]]
//
//   ---   (separator between nodes)

function parseVault(text) {
  const sections = text.split(/\n(?=## Node:)/);
  const fileData = [];
  sections.forEach(sec => {
    const titleMatch = sec.match(/^## Node:\s*(.+)/m);
    if (!titleMatch) return;
    const name = titleMatch[1].trim();
    const colorMatch = sec.match(/^color:\s*(#[0-9a-fA-F]{3,8})\s*$/m);
    const customColor = colorMatch ? colorMatch[1] : null;
    const linksMatch = sec.match(/^links:\s*(.+)$/m);
    const links = linksMatch ? linksMatch[1] : null;
    let body = sec.replace(/^## Node:.*\n?/m, '');
    body = body.replace(/^(?:links:|color:)[^\n]*\n?/gm, '');
    body = body.replace(/^---\s*$/gm, '').trim();
    fileData.push({ name, content: body, customColor, links });
  });
  return fileData;
}

function serializeVault() {
  let out = '';
  nodes.filter(n => !n.isGhost).forEach((n, i) => {
    if (i > 0) out += '\n---\n\n';
    out += `## Node: ${n.label}\n`;
    const linked = edges
      .filter(e => e.s === n.id || e.t === n.id)
      .map(e => { const otherId = e.s === n.id ? e.t : e.s; const o = nodes.find(x => x.id === otherId); return o ? o.label : null; })
      .filter(Boolean);
    if (linked.length) out += `links: ${linked.map(l => `[[${l}]]`).join(', ')}\n`;
    if (n._customColor) out += `color: ${n.color}\n`;
    out += '\n';
    if (n.content) out += n.content.trimEnd() + '\n';
    out += '\n';
  });
  return out.trimEnd() + '\n';
}

function saveVault() {
  const text = serializeVault();
  const blob = new Blob([text], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = vaultFilename || 'vault.md';
  a.click();
  URL.revokeObjectURL(a.href);
}

let vaultFilename = 'vault.md';

function loadVaultFile(file) {
  if (!file) return;
  vaultFilename = file.name;
  const r = new FileReader();
  r.onload = e => buildGraph(parseVault(e.target.result));
  r.readAsText(file);
}

function buildGraph(fileData) {
  nodes = []; edges = []; uid = 1;
  const nameToId = {};

  fileData.forEach(f => {
    const id = uid++;
    nameToId[f.name.toLowerCase()] = id;
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 220;
    nodes.push({ id, label: f.name, color: C.gray, x: Math.cos(a) * d, y: Math.sin(a) * d, vx: 0, vy: 0, fx: null, fy: null, isGhost: false, content: f.content || '', _customColor: !!f.customColor });
  });

  const edgeSet = new Set();
  fileData.forEach(f => {
    const srcId = nameToId[f.name.toLowerCase()];
    const linksFromField = f.links ? new Set([...extractWikilinks(f.links)]) : new Set();
    const allLinks = new Set([...extractWikilinks(f.content || ''), ...linksFromField]);
    allLinks.forEach(target => {
      const key_lower = target.toLowerCase();
      let tgtId = nameToId[key_lower];
      if (tgtId === undefined) {
        tgtId = uid++;
        nameToId[key_lower] = tgtId;
        const a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 260;
        nodes.push({ id: tgtId, label: target, color: C.gray, x: Math.cos(a) * d, y: Math.sin(a) * d, vx: 0, vy: 0, fx: null, fy: null, isGhost: true, content: '' });
      }
      const ek = [Math.min(srcId, tgtId), Math.max(srcId, tgtId)].join('-');
      if (!edgeSet.has(ek)) { edgeSet.add(ek); edges.push({ s: srcId, t: tgtId }); }
    });
  });

  fileData.forEach(f => {
    if (f.customColor) {
      const n = nodes.find(x => x.label === f.name);
      if (n) { n.color = f.customColor; n._customColor = true; }
    }
  });
  nodes.forEach(n => {
    if (n.isGhost || n._customColor) return;
    n.color = colorForDeg(edges.filter(e => e.s === n.id || e.t === n.id).length);
  });

  showUI();
  resetView();
  updateStats();
}