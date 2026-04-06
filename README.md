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

## File Documentation

### `index.html`
Pure markup — no inline styles or scripts. Contains all the HTML elements (canvas, toolbar, editor panel, drop zone, modals, legend) and loads scripts in dependency order at the bottom of the body. If you need to add a new UI element, this is where it lives.

Script load order is intentional:
```
graph.js → draw.js → io.js → editor.js → ui.js → interaction.js → main.js
```

---

### `style/main.css`
All styles for the application. Organized roughly as:

- **Reset & body** — base layout, full-viewport canvas
- **Toolbar & buttons** — top-center toolbar, `.btn` and `.btn.active` states
- **Search & stats** — top-right search bar, top-left node/edge counter
- **Tooltip & info bar** — hover label, bottom hint bar
- **Drop zone** — empty state overlay for vault loading
- **Modal** — generic modal box used for node naming dialogs
- **Inline node input** — the floating input that appears when creating a node
- **Legend** — bottom-right color legend
- **Editor panel** — slide-in note editor, color swatches, header/footer

---

### `js/graph.js`
Core graph state and logic. Everything else reads from or writes to the variables defined here.

**State variables:**
- `nodes`, `edges` — the graph data arrays
- `selected`, `hovered`, `hoveredEdge` — interaction state
- `linkMode`, `cutMode`, `linkFirst` — mode flags for the link and cut tools
- `physicsOn`, `camX`, `camY`, `zoom` — camera and simulation state
- `uid` — auto-incrementing node ID counter

**Constants:**
- `C` — named color shortcuts (purple, blue, teal, amber, gray)
- `PALETTE` — 27-color array used in the editor color picker

**Functions:**
- `colorForDeg(deg)` — returns a color based on a node's connection count
- `nodeRadius(id)` — computes node size from degree; more links = bigger node
- `recolorAll()` — updates color of every non-custom node based on current degree
- `addNode(wx, wy, label)` — creates a new node at world coordinates
- `deleteNode(n)` — removes a node and all its edges
- `deleteSelected()` — deletes whichever node is currently selected
- `toWorld(cx, cy)` — converts screen coordinates to world/canvas coordinates
- `getNodeAt(cx, cy)` — hit-tests screen coordinates against all nodes
- `getEdgeAt(cx, cy)` — hit-tests screen coordinates against all edges
- `tick()` — runs one frame of the physics simulation (repulsion + spring forces)

---

### `js/draw.js`
Canvas rendering. Called every frame by the main loop. Reads global state but never writes to it.

**`draw()`** — the single exported function. Renders in this order:
1. Clear canvas, fill background
2. Draw grid (scales with zoom)
3. Save canvas transform, apply camera (translate + scale)
4. Compute focus set — which nodes are "in focus" based on `focusNodeId`
5. Draw edges — styled by hover, selection, cut mode, and focus dimming
6. Draw link preview — dashed line from `linkFirst` to cursor in link mode
7. Draw nodes — glow rings, fill circles, inline dashed ring, labels
8. Draw link-mode selection ring around `linkFirst` node
9. Restore canvas transform

---

### `js/io.js`
Everything related to reading and writing vault `.md` files.

**Vault format:**
```
## Node: Title
links: [[A]], [[B]]
color: #7c6fcd

Body text with optional [[wikilinks]]

---
```

**Functions:**
- `extractWikilinks(text)` — parses `[[wikilink]]` syntax from a string, returns a Set of target names
- `parseVault(text)` — splits a vault file into sections and extracts name, body, color, and links from each
- `serializeVault()` — converts current `nodes` and `edges` back into vault `.md` text
- `saveVault()` — serializes and triggers a file download
- `loadVaultFile(file)` — reads a File object and calls `buildGraph`
- `buildGraph(fileData)` — takes parsed vault data, constructs the `nodes` and `edges` arrays, creates ghost nodes for unresolved wikilinks, applies custom colors, and initializes the UI

---

### `js/editor.js`
The slide-in note editor panel on the right side of the screen.

**State:**
- `editorOpen` — whether the panel is currently visible
- `editorNodeId` — ID of the node being edited, or null for a new node
- `focusNodeId` — ID of the node currently in focus mode (dims unrelated nodes)

**Functions:**
- `buildEditorSwatches(node)` — populates the color palette in the editor, marks the active swatch, wires up the auto/reset button
- `openEditor(nodeId)` — opens the panel for an existing node (or blank for new), populates title/body/color fields
- `closeEditor(save)` — closes the panel; if `save` is true, writes changes back to the node, handles new wikilink edges, and calls `recolorAll`

---

### `js/ui.js`
Toolbar button handlers and general UI state helpers. Thin functions that mostly toggle flags and update button appearance.

**Functions:**
- `updateStats()` — refreshes the node and edge count display
- `showUI()` — hides the drop zone and reveals the toolbar, search, stats, and legend
- `startFresh()` — resets all state and opens the UI with a blank graph
- `toggleLinkMode()` — toggles link drawing mode, updates button active state
- `toggleCutMode()` — toggles edge deletion mode, updates button active state
- `togglePhysics()` — pauses/resumes the physics simulation
- `resetView()` — snaps camera back to default zoom and center
- `searchNodes(v)` — sets `searchHighlight` for the draw loop to use

---

### `js/interaction.js`
All user input handling. Reads and writes global state, calls functions from other modules.

**Drag & drop:**
- Listens for `.md` files dropped anywhere on the page and calls `loadVaultFile`

**Mouse events on canvas:**
- `mousemove` — updates `hovered`, `hoveredEdge`, tooltip position, handles node dragging and camera panning
- `mousedown` — handles cut mode edge deletion, shift-click focus toggle, link mode node selection, node drag start, camera pan start
- `mouseup` — releases dragged node, ends pan
- `contextmenu` — right-click deletes node or edge
- `wheel` — zoom in/out centered on cursor position
- `dblclick` — opens editor for clicked node

**Keyboard (`keydown`):**
- `Enter` — starts inline node creation (when not typing)
- `Escape` — cancels inline creation, exits link/cut mode, closes editor
- `A` — toggle link mode
- `C` — toggle cut mode
- `D` / `Delete` / `Backspace` — delete selected node

**Inline node creation:**
- `startInlineNode()` — spawns a temporary pinned node at screen center, shows the naming input
- `positionInlineInput()` — keeps the input element positioned under the node each frame
- `confirmInlineNode()` — finalizes the node name, releases physics pin
- `cancelInlineNode()` — removes the temporary node and hides the input

---

### `js/main.js`
Entry point. Initializes the canvas, sets up the resize listener, and starts the animation loop.

**`loop()`** — the `requestAnimationFrame` loop that calls `tick()` → `draw()` each frame, and repositions the inline node input if active.

---

## LegacyCode

### `LegacyCode/obsidian-graph.html`
The original single-file implementation. Kept as a reference. If something breaks in the refactored version, this is the source of truth for intended behavior.

---

## Vault File Format

Vaults are plain `.md` files you can open in any text editor.

```markdown
## Node: My Note
links: [[Other Note]], [[Another Note]]
color: #7c6fcd

This is the body of the note.
You can use [[wikilinks]] here too.

---

## Node: Other Note

Body of the second note.
```

- `## Node:` — required, defines a node. Everything until the next `---` or `## Node:` belongs to it.
- `links:` — optional, manually saved edge list. Auto-populated on save.
- `color:` — optional, persists a custom node color.
- `---` — separator between nodes.
- Body text is freeform. `[[wikilinks]]` in the body auto-create edges on load.

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
