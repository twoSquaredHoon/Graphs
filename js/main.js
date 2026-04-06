// ── Canvas setup ──────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resize() { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; }
resize();
window.addEventListener('resize', () => { resize(); draw(); });

// ── Main loop ─────────────────────────────────────────────────────────
function loop() {
  tick();
  draw();
  if (inlineActive) positionInlineInput();
  requestAnimationFrame(loop);
}
loop();