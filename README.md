# Graph Interactions

A single-page, browser-based graph visualization tool inspired by Obsidian's graph view. Built with vanilla HTML/CSS/JS and a canvas renderer — no dependencies, no build step, no server required.

---

## Quick Start

```bash
open index.html
```

Or if your browser restricts local file access:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

---

## File Structure

```
GraphInteractions/
├── index.html
├── style/
│   └── main.css
├── js/
│   ├── graph.js
│   ├── draw.js
│   ├── io.js
│   ├── editor.js
│   ├── ui.js
│   ├── interaction.js
│   └── main.js
└── LegacyCode/
    └── obsidian-graph.html
```

---

## Data Shapes

These are the core objects that flow through every module. If you're adding a feature, you'll be reading or writing these.

### Node object
```js
{
  id:           Number,      // unique integer, auto-incremented by uid++
  label:        String,      // display name, also used for wikilink matching
  x:            Number,      // world-space position (not screen pixels)
  y:            Number,
  vx:           Number,      // velocity, used by physics tick
  vy:           Number,
  fx:           Number|null, // pinned position — physics locks to fx/fy when set
  fy:           Number|null, // set to null to release the pin and let physics take over
  color:        String,      // hex color string
  isGhost:      Boolean,     // true = created from an unresolved [[wikilink]], not serialized on save
  content:      String,      // note body text
  _customColor: Boolean,     // true = color was manually set, skipped by recolorAll()
  _inline:      Boolean,     // true = node is mid-creation, shows dashed ring, not yet named
}
```

**Key gotcha — `fx`/`fy` pinning:** Setting `fx` and `fy` to a value locks the node in place during physics. Setting them back to `null` releases it. Any time you move a node programmatically and want physics to take over afterward, make sure you null both. Forgetting this is the most common source of "stuck node" bugs.

### Edge object
```js
{
  s: Number,  // source node id
  t: Number,  // target node id
}
```

Edges are undirected — `s` and `t` are just the two endpoints. When querying edges for a node, always check both directions: `e.s === id || e.t === id`.

---

## File Documentation

### `index.html`
Pure markup — no inline styles or scripts. Contains all the HTML elements (canvas, toolbar, editor panel, drop zone, modals, legend) and loads scripts in dependency order at the bottom of the body. If you need to add a new UI element, this is where it lives.

**Script load order is intentional and must be preserved:**
```
graph.js → draw.js → io.js → editor.js → ui.js → interaction.js → main.js
```

`graph.js` defines all shared state (`nodes`, `edges`, `C`, `PALETTE`, etc.). Every other module reads from it. If any script loads before `graph.js`, it will reference undefined variables and break silently. `main.js` goes last because it starts the animation loop — the loop calls `tick()` and `draw()`, which must already be defined.

---

### `style/main.css`
All styles for the application. Organized roughly as:

- **Reset & body** — base layout, full-viewport canvas. Background color: `#0d0a08` (warm near-black)
- **Toolbar & buttons** — top-center toolbar, `.btn` and `.btn.active` states. Active accent color: `#7a5c3a`
- **Search & stats** — top-right search bar, top-left node/edge counter
- **Tooltip & info bar** — hover label (`#node-label`), bottom hint bar (`#info`)
- **Drop zone** — empty state overlay for vault loading, shown until a vault is opened or "Start fresh" is clicked
- **Modal** — generic modal box (`#modal`, `#mbox`) used for node naming dialogs
- **Inline node input** — the floating input (`#node-input-wrap`) that appears centered under a new node during creation
- **Legend** — bottom-right color legend, hidden until UI is shown
- **Editor panel** — slide-in note editor (`#editor`), color swatches, header/footer

---

### `js/graph.js`
Core graph state and logic. Everything else reads from or writes to the variables defined here. This is the only file with no dependencies — it is the foundation everything else builds on.

**State variables:**
- `nodes`, `edges` — the graph data arrays. Treat these as the single source of truth
- `selected`, `hovered`, `hoveredEdge` — current interaction state, updated each frame by `interaction.js`
- `linkMode`, `cutMode`, `linkFirst` — mode flags for the link and cut tools
- `physicsOn`, `camX`, `camY`, `zoom` — camera and simulation state
- `uid` — auto-incrementing ID counter. Always use `uid++` when creating a new node, never assign IDs manually
- `W`, `H` — canvas dimensions in pixels, set by `main.js` on init and resize

**Constants:**
- `C` — named color shortcuts (`purple`, `blue`, `teal`, `amber`, `gray`) used by `colorForDeg()` and as defaults when creating nodes
- `PALETTE` — 27-color array rendered as swatches in the editor color picker. Currently sharp/vibrant colors across purples, blues, teals, greens, ambers, oranges, reds, pinks, and magentas

**Functions:**
- `colorForDeg(deg)` — maps connection count to a color from `C`. Thresholds: 0 → gray, 1–2 → blue, 3–5 → purple, 6–9 → teal, 10+ → amber
- `nodeRadius(id)` — computes node size as `5 + degree * 3`. More connections = bigger node
- `recolorAll()` — iterates all nodes and updates color based on current degree, skipping nodes where `_customColor: true` or `isGhost: true`
- `addNode(wx, wy, label)` — creates a node at world coordinates. Low-level helper; most node creation goes through `startInlineNode()` or `closeEditor()`
- `deleteNode(n)` — removes a node and all connected edges, clears `selected` if it was that node, calls `recolorAll()` and `updateStats()`
- `deleteSelected()` — convenience wrapper around `deleteNode(selected)`
- `toWorld(cx, cy)` — converts screen/client coordinates to world coordinates, accounting for `camX`, `camY`, and `zoom`
- `getNodeAt(cx, cy)` — hit-tests screen coordinates against all nodes, returns the topmost match or `null`. Hit radius is `nodeRadius + 3` pixels
- `getEdgeAt(cx, cy)` — hit-tests screen coordinates against all edges using point-to-segment distance, returns closest edge within `7/zoom` pixels or `null`
- `tick()` — one frame of physics: applies damping, node-node repulsion, edge spring forces, center gravity, then integrates velocity into position. Pinned nodes (`fx !== null`) are held in place

---

### `js/draw.js`
Canvas rendering. Called every frame by the main loop. Reads global state but never writes to it — purely a read-and-render module.

**`draw()`** — the single exported function. Renders in this order:
1. Clear canvas, fill background (`#0d0a08`)
2. Draw grid — 40px cells, offset by camera position so it scrolls with the world, opacity `0.03`
3. Save canvas transform, apply camera (`translate camX/camY` then `scale zoom`)
4. Compute focus set — if `focusNodeId` is set, build a Set of that node plus all its direct neighbors. Nodes/edges outside this set are dimmed
5. Draw edges — color and weight varies by hover state, selection, cut mode hover, and focus dimming
6. Draw link preview — dashed line from `linkFirst` to the currently hovered node while in link mode
7. Draw nodes — for each node: optional glow ring (hover/select/search), filled circle, stroke ring (or dashed ring if `_inline`), label text below
8. Draw link-mode selection ring around `linkFirst` node
9. Restore canvas transform

**Node rendering details:**
- Glow ring uses a radial gradient from `node.color + '66'` (40% opacity) outward to transparent
- Search highlight uses `C.amber` for the glow instead of the node's own color
- Ghost nodes render at 50% opacity with a faint stroke
- Labels are hidden below zoom `0.35` unless the node is hovered, selected, or inline
- Font size scales with zoom, clamped between 8–13px

---

### `js/io.js`
Everything related to reading and writing vault `.md` files. Also owns the `vaultFilename` state and `buildGraph()`, which constructs the live graph from parsed data.

**State:**
- `vaultFilename` — the filename used when saving. Set to the loaded file's name on `loadVaultFile()`, defaults to `'vault.md'` on fresh start

**Vault format:**
```
## Node: Title
links: [[A]], [[B]]
color: #a78bfa

Body text with optional [[wikilinks]]

---
```

**Functions:**
- `extractWikilinks(text)` — parses `[[wikilink]]` syntax from any string, returns a `Set` of target name strings. Handles pipe aliases (`[[Name|Alias]]`) by extracting only the target
- `parseVault(text)` — splits a vault file on `## Node:` boundaries and extracts `name`, `content`, `customColor`, and `links` from each section. Strips `links:`, `color:`, and `---` lines from body so they never bleed into note content
- `serializeVault()` — iterates non-ghost nodes, writes `## Node:`, `links:`, `color:` (if custom), and body content. All edges are written to the `links:` field — this is what persists manual links across save/load cycles
- `saveVault()` — calls `serializeVault()` and triggers a browser file download
- `loadVaultFile(file)` — reads a `File` object as text, calls `parseVault()` then `buildGraph()`
- `buildGraph(fileData)` — constructs `nodes` and `edges` from parsed vault data. Ghost nodes are created here for any wikilink target that doesn't match an existing node. Custom colors are applied after the graph is built. Calls `showUI()`, `resetView()`, `updateStats()`

**Important:** Ghost nodes are never written to the vault on save (`serializeVault` filters with `n.isGhost`). They exist only in memory to represent unresolved references and disappear if the vault is saved and reloaded without their target nodes being created.

---

### `js/editor.js`
The slide-in note editor panel on the right side of the screen. Also owns `focusNodeId`, which is shared with `draw.js` (for dimming) and `interaction.js` (for shift-click toggling).

**State:**
- `editorOpen` — whether the panel is currently visible
- `editorNodeId` — ID of the node being edited, or `null` when creating a new node
- `focusNodeId` — ID of the node currently in focus mode. When set, `draw.js` dims all nodes and edges not directly connected to it. Set by `openEditor()`, cleared by `closeEditor()`, and toggled independently by shift-click in `interaction.js`

**Focus mode — how it works across files:**
Focus mode is driven by a single shared variable (`focusNodeId`) that three files coordinate around:
- `editor.js` — sets `focusNodeId` when the editor opens, clears it on close
- `interaction.js` — shift-click on a node toggles `focusNodeId` without opening the editor; clicking empty canvas clears it
- `draw.js` — reads `focusNodeId` each frame to compute the focus set and dim non-members to `0.15` opacity (nodes) and `0.08` opacity (edges)

**Functions:**
- `buildEditorSwatches(node)` — clears and rebuilds the color swatch grid from `PALETTE`. Marks the active swatch if the node has a custom color. Wires up the "auto" reset button to clear `_customColor` and call `recolorAll()`
- `openEditor(nodeId)` — opens the panel for an existing node (populates title/body/color) or blank for a new one. Sets `focusNodeId` to the same node
- `closeEditor(save)` — closes the panel. If `save` is true: updates the node's label and content, adds any new wikilink edges found in the body without removing manual edges, or creates a brand new node if `editorNodeId` was null. Always clears `focusNodeId`

---

### `js/ui.js`
Toolbar button handlers and general UI state helpers. Thin functions that mostly toggle flags and update button appearance.

**Functions:**
- `updateStats()` — refreshes the node count (excluding ghosts) and edge count in the top-left display
- `showUI()` — hides the drop zone overlay and shows the toolbar, search bar, stats, legend, and info bar. Called once after a vault loads or "Start fresh" is clicked
- `startFresh()` — resets `nodes`, `edges`, `uid`, and `vaultFilename` to defaults, calls `showUI()`, `resetView()`, `updateStats()`, then immediately starts inline node creation so the user can name their first node
- `toggleLinkMode()` — toggles `linkMode`, resets `linkFirst` to null, updates the Link button's active class
- `toggleCutMode()` — toggles `cutMode`, updates the Cut button's active class
- `togglePhysics()` — toggles `physicsOn`, updates the Physics button label to "⚡ Physics" or "⏸ Paused"
- `resetView()` — sets `zoom = 1`, `camX = W/2`, `camY = H/2`
- `searchNodes(v)` — sets `searchHighlight` to the trimmed lowercase search string, or `null` if empty. `draw.js` uses this to apply amber glow to matching nodes

---

### `js/interaction.js`
All user input handling. Reads and writes global state, calls functions from other modules. The largest and most interconnected file.

**Drag & drop vault loading:**
Listens on `document` for `dragover`, `dragleave`, and `drop`. Filters dropped files for `.md` extension and calls `loadVaultFile()`. Only active while the drop overlay is visible.

**Mouse events on canvas:**
- `mousemove` — updates `hovered` and `hoveredEdge` each frame, positions the tooltip, handles node dragging (updates `fx`/`fy` directly) and camera panning
- `mousedown` — priority order: cut mode edge delete → shift-click focus toggle → link mode first/second click → node drag start → canvas pan start. When the editor is open, clicking the canvas still pans but does not clear `selected` or `focusNodeId`
- `mouseup` — nulls `fx`/`fy` on the dragged node to release the physics pin, clears `dragging` and `panStart`
- `contextmenu` — right-click on a node deletes it; right-click on an edge deletes it; right-click on empty space does nothing
- `wheel` — zooms centered on the cursor by adjusting `zoom`, `camX`, and `camY` together
- `dblclick` — calls `openEditor(n.id)` for the clicked node

**Keyboard (`keydown`):**
- `Enter` — starts inline node creation when not focused on an input/textarea and the editor is closed
- `Escape` — priority: cancel inline creation → exit link/cut mode → close editor without saving
- `A` — toggle link mode (blocked while typing or editor open)
- `C` — toggle cut mode (blocked while typing or editor open)
- `D` / `Delete` / `Backspace` — delete selected node (blocked while typing)

**Inline node creation flow:**
1. `startInlineNode()` — creates a temporary node at world-center with `_inline: true`, pins it with `fx`/`fy`, shows the naming input below it
2. Each frame, `positionInlineInput()` re-positions the input element to stay under the node as the camera moves
3. `confirmInlineNode()` — on Enter: sets the label, releases the physics pin (`fx = fy = null`), unpins any other nodes stacked at the same position, calls `recolorAll()` and `updateStats()`
4. `cancelInlineNode()` — on Escape or empty name: removes the temp node entirely

---

### `js/main.js`
Entry point. Initializes canvas dimensions, sets up the resize listener, and starts the animation loop.

**`loop()`** — the `requestAnimationFrame` loop. Each frame: `tick()` advances physics → `draw()` renders the frame → `positionInlineInput()` repositions the node naming input if active.

---

## Color System

Node color comes from one of two sources, checked in this order:

1. **Custom color** — if `node._customColor` is `true`, the `color` field is used as-is. Set via the editor color picker. Persisted in the vault file under `color:`. Never overwritten by `recolorAll()`
2. **Degree-based color** — if no custom color, `colorForDeg()` picks from the `C` constants based on connection count

The `PALETTE` array in `graph.js` is the only place to change what colors appear in the editor swatches. It has no effect on degree-based coloring — change `C` for that.

Opening a vault restores custom colors exactly as saved. The palette only affects what options are shown in the picker going forward.

---

## LegacyCode

### `LegacyCode/obsidian-graph.html`
The original single-file implementation before the refactor. Kept as a reference. If something breaks in the refactored version, this is the source of truth for intended behavior. Do not edit it.

---

## Vault File Format

Vaults are plain `.md` files readable in any text editor.

```markdown
## Node: My Note
links: [[Other Note]], [[Another Note]]
color: #a78bfa

This is the body of the note.
You can use [[wikilinks]] here too.

---

## Node: Other Note

Body of the second note.
```

- `## Node:` — required, defines a node. Everything until the next `---` or `## Node:` belongs to it
- `links:` — optional, the saved edge list. Auto-written on every save, covers both manual and wikilink-derived edges
- `color:` — optional, persists a custom node color. Omitted if the node uses auto degree-based coloring
- `---` — separator between nodes
- Body text is freeform. `[[wikilinks]]` in the body auto-create edges on load

**Ghost nodes are not saved.** If a node exists only because it was referenced by a `[[wikilink]]` but was never created as a real node, it will not appear in the vault file. It will be recreated as a ghost on next load if the wikilink reference still exists.

---

## How To: Add a New Toolbar Button

Adding a button end-to-end touches three files:

1. **`index.html`** — add the button inside `#toolbar`:
```html
<button class="btn" id="btn-myfeature" onclick="toggleMyFeature()">Label</button>
```

2. **`js/graph.js`** — add the state variable:
```js
let myFeatureOn = false;
```

3. **`js/ui.js`** — add the toggle function:
```js
function toggleMyFeature() {
  myFeatureOn = !myFeatureOn;
  document.getElementById('btn-myfeature').classList.toggle('active', myFeatureOn);
}
```

4. **`js/interaction.js`** — handle the behavior in the relevant mouse/keyboard event listeners.

---

## Common Gotchas

**Nodes stuck after dragging or programmatic move:**
You forgot to null `fx` and `fy`. Physics only moves nodes where both are `null`. After any manual position set, do `node.fx = null; node.fy = null` to hand control back to the simulation.

**Duplicate edges:**
Always check both directions before pushing a new edge: `(e.s === a && e.t === b) || (e.s === b && e.t === a)`. There is no built-in deduplication.

**`recolorAll()` wiping custom colors:**
It won't — it skips nodes where `_customColor` is `true`. But if you create a node programmatically and forget to set `_customColor`, the next `recolorAll()` call will overwrite whatever color you set.

**Ghost nodes showing up in the vault:**
`serializeVault()` filters them with `nodes.filter(n => !n.isGhost)`. If a ghost seems to be saving, check that `isGhost` is actually `true` on it.

**Script load order errors:**
If you see `Uncaught ReferenceError: nodes is not defined` on page load, a script is loading before `graph.js`. All shared state lives in `graph.js` — it must be first.

**Stale search highlight after vault load:**
`searchHighlight` is not reset by `buildGraph()`. If you load a new vault while a search is active, the highlight carries over. Call `searchNodes('')` inside `buildGraph()` to fix this.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | New node |
| `A` | Toggle link mode |
| `C` | Toggle cut mode |
| `D` | Delete selected node |
| `Delete` / `Backspace` | Delete selected node |
| `Escape` | Cancel / close / exit mode |
| `Shift + click` | Toggle focus mode on node |
| `Double-click` | Open note editor |
| `Right-click` | Delete node or edge |
| Scroll | Zoom in / out |
| Drag (canvas) | Pan |
| Drag (node) | Reposition node |

---

## TODO

### Features
- [ ] **Node position persistence** — save `x`, `y` to the vault so layout is restored on load. Currently every load randomizes positions and relies on physics to settle
- [ ] **Minimap** — small overview in a corner showing the full graph with a viewport indicator
- [ ] **Multi-select** — drag to box-select or lasso-select multiple nodes; move, delete, or recolor as a group
- [ ] **Edge labels** — name a connection between two nodes; display on hover or always
- [ ] **Undo / redo** — command history for node creation, deletion, linking, and edits
- [ ] **Search that filters** — hide non-matching nodes and edges instead of just highlighting, with a toggle between modes
- [ ] **Markdown preview** — toggle inside the editor between raw text and rendered markdown
- [ ] **Export as PNG / SVG** — snapshot the current canvas view

### Visual / UX
- [ ] **Curved edges** — quadratic bezier curves instead of straight lines
- [ ] **Smooth reset view** — ease the camera back to center instead of snapping instantly
- [ ] **Node pulse on creation** — brief scale animation when a new node is confirmed
- [ ] **Focus mode blur** — use CSS `filter: blur()` on dimmed nodes instead of just opacity reduction
- [ ] **Right-click context menu** — show Edit / Delete / Focus / Copy name instead of immediate delete
- [ ] **Dark/light theme toggle** — CSS variable-based theming switchable at runtime
- [ ] **Custom cursor in link/cut mode** — crosshair with a small indicator ring

### Refactor / Maintenance
- [ ] **Clear search on vault load** — call `searchNodes('')` inside `buildGraph()` so stale highlights don't carry over between vaults
- [ ] **Ghost node promotion** — double-clicking a ghost node should open the editor and convert it to a real node on save, instead of doing nothing
- [ ] **Edge deduplication helper** — extract the `(e.s===a&&e.t===b)||(e.s===b&&e.t===a)` check into a named utility function used consistently across `io.js`, `editor.js`, and `interaction.js`
- [ ] **Node object factory** — replace scattered object literals with a single `createNode(id, label, x, y, opts)` function so the shape is defined in one place
- [ ] **`W` and `H` ownership** — currently declared in `graph.js` but set in `main.js`; consider moving both declaration and initialization to `main.js`
