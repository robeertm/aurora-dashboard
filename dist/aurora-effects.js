/*
 * Aurora Effects — tiny, dependency-free style helper for the Aurora dashboard.
 *
 * Injects two things into shadow DOM (which plain themes cannot reach):
 *  1. Glass blur on every ha-card — only while the Aurora theme is active
 *     (gated by the theme variable `aurora-fx`).
 *  2. The scan-pulse animation on every apexcharts-card series named "scan"
 *     (a short bright dash travelling along the curve, mission-control style).
 *
 * No card-mod required. © 2026 Robert Manuwald — use only, see LICENSE.
 */
(() => {
  // Shared keyframe library. Injected into every card shadow root so any
  // button-card template can reference these by name — a child template's
  // own `extra_styles` REPLACES its parent's, so keyframes defined in a
  // parent template would otherwise be lost.
  const KEYFRAMES = `
    @keyframes aurora-breathe {
      0%,100% { filter: drop-shadow(0 0 3px var(--aurora-glow,#89b4fa)); }
      50%     { filter: drop-shadow(0 0 13px var(--aurora-glow,#89b4fa)); }
    }
    @keyframes aurora-pulse {
      0%,100% { transform: scale(1); opacity: 1; }
      50%     { transform: scale(1.22); opacity: .6; }
    }
    @keyframes aurora-spin { to { transform: rotate(360deg); } }
    @keyframes aurora-halo {
      0%       { box-shadow: 0 0 0 0 color-mix(in srgb, var(--aurora-glow,#f9e2af) 45%, transparent); }
      70%,100% { box-shadow: 0 0 0 12px transparent; }
    }
    /* gentle idle motion for small icons */
    @keyframes aurora-float {
      0%,100% { transform: translateY(0); }
      50%     { transform: translateY(-2.5px); }
    }
    @keyframes aurora-swing {
      0%,100% { transform: rotate(-7deg); }
      50%     { transform: rotate(7deg); }
    }
    @keyframes aurora-wobble {
      0%,100% { transform: rotate(0deg) scale(1); }
      25%     { transform: rotate(4deg) scale(1.05); }
      75%     { transform: rotate(-4deg) scale(1.05); }
    }
    @keyframes aurora-shimmer {
      0%,100% { opacity: .55; filter: saturate(1); }
      50%     { opacity: 1; filter: saturate(1.6) drop-shadow(0 0 8px var(--aurora-glow,#cba6f7)); }
    }
    @keyframes aurora-blink {
      0%,45%,100% { opacity: 1; }
      50%,55%     { opacity: .25; }
    }
    @keyframes aurora-bob {
      0%,100% { transform: translateY(0) rotate(0deg); }
      30%     { transform: translateY(-2px) rotate(-5deg); }
      70%     { transform: translateY(1px) rotate(5deg); }
    }
    @keyframes aurora-flicker {
      0%,100% { opacity: 1; }
      41%     { opacity: 1; }
      42%     { opacity: .55; }
      45%     { opacity: 1; }
      92%     { opacity: .7; }
      94%     { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; }
    }
  `;

  // Full glass treatment for top-level cards: strong blur, a diagonal light
  // sheen plus a faint top-edge highlight (::before overlay).
  const GLASS = `
    ha-card {
      position: relative;
      backdrop-filter: blur(18px) saturate(1.45);
      -webkit-backdrop-filter: blur(18px) saturate(1.45);
      transition: border-color .3s ease, box-shadow .3s ease;
    }
    ha-card::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      background:
        linear-gradient(125deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 30%, transparent 55%),
        radial-gradient(130% 70% at 85% -15%, rgba(180,190,254,0.10), transparent 60%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.07);
    }
    ha-card:hover {
      border-color: rgba(180,190,254,.25);
    }
  `;
  // Cards nested inside stack-in-card share their parent's glass surface —
  // blur only, no per-segment sheen.
  const GLASS_INNER = `
    ha-card {
      backdrop-filter: blur(14px) saturate(1.2);
      -webkit-backdrop-filter: blur(14px) saturate(1.2);
    }
  `;
  const APEX = `
    .apexcharts-series[seriesName="scan"] path {
      stroke-dasharray: 4 1200;
      stroke-linecap: round;
      animation: aurora-scan 7s linear infinite;
      filter: brightness(1.7) drop-shadow(0 0 4px rgba(255,255,255,0.9));
    }
    @keyframes aurora-scan {
      from { stroke-dashoffset: 0; }
      to   { stroke-dashoffset: -1204; }
    }
    @media (prefers-reduced-motion: reduce) {
      .apexcharts-series[seriesName="scan"] path {
        animation: none;
        visibility: hidden;
      }
    }
  `;

  const apexDone = new WeakSet();
  const glassDone = new WeakSet();
  const baseCols = new WeakMap();

  // Enthaelt der Grid-Inhalt "breite" Karten (Charts/Uhr/Stacks)?
  const WIDE = ["CLOCK-WEATHER-CARD", "STACK-IN-CARD", "APEXCHARTS-CARD", "HUI-VERTICAL-STACK-CARD"];
  const deepHas = (node, depth) => {
    if (!node || depth < 0) return false;
    const roots = node.shadowRoot ? [node.shadowRoot, node] : [node];
    for (const r of roots) {
      for (const c of r.children || []) {
        if (WIDE.includes(c.tagName)) return true;
        if (deepHas(c, depth - 1)) return true;
      }
    }
    return false;
  };

  // Is this card element rendered inside a stack-in-card (composed tree)?
  const insideStack = (el) => {
    let n = el;
    for (let i = 0; i < 15 && n; i++) {
      n = n.parentNode;
      if (n && n.nodeType === 11) n = n.host; // hop out of shadow roots
      if (n && n.tagName === "STACK-IN-CARD") return true;
    }
    return false;
  };

  const inject = (sr, css) => {
    const s = document.createElement("style");
    s.textContent = css;
    sr.appendChild(s);
  };

  const auroraActive = (el) => {
    try {
      return getComputedStyle(el).getPropertyValue("--aurora-fx").trim() !== "";
    } catch (e) {
      return false;
    }
  };

  const handle = (el) => {
    const sr = el.shadowRoot;
    if (!sr) return;
    if (el.tagName === "APEXCHARTS-CARD") {
      if (!apexDone.has(sr)) {
        apexDone.add(sr);
        inject(sr, APEX);
      }
      for (const li of sr.querySelectorAll(".apexcharts-legend-series")) {
        if (li.textContent.trim().toLowerCase().startsWith("scan")) li.style.display = "none";
      }
    }
    // Responsive: Spaltenzahl aus der TATSAECHLICHEN Breite ableiten statt aus
    // Breakpoints — ein Grid in einer schmalen Innenspalte ist genauso eng wie
    // eines auf dem Handy, und feste Media Queries sehen den Unterschied nicht.
    if (el.tagName === "HUI-GRID-CARD") {
      const root = sr.querySelector("#root");
      if (root && root.children.length) {
        if (!baseCols.has(root)) {
          baseCols.set(root, getComputedStyle(root).gridTemplateColumns.split(" ").length);
        }
        const base = baseCols.get(root);
        const w = root.getBoundingClientRect().width;
        if (w > 0) {
          // Breite Inhalte (Charts, Thermostate, Stacks) brauchen deutlich mehr Platz.
          const min = deepHas(root, 4) ? 300 : 132;
          const cols = Math.max(1, Math.min(base, Math.floor(w / min)));
          if (root.dataset.auroraCols !== String(cols)) {
            root.dataset.auroraCols = String(cols);
            root.style.gridTemplateColumns = "repeat(" + cols + ", minmax(0, 1fr))";
          }
        }
      }
    }
    // Theme var may arrive late — keep re-checking until injected.
    if (!glassDone.has(sr) && sr.querySelector("ha-card") && auroraActive(el)) {
      glassDone.add(sr);
      inject(sr, KEYFRAMES + (insideStack(el) ? GLASS_INNER : GLASS));
    }
  };

  const walk = (node) => {
    if (node.shadowRoot) {
      handle(node);
      for (const c of node.shadowRoot.children) walk(c);
    }
    for (const c of node.children) walk(c);
  };

  const sweep = () => {
    try {
      walk(document.body);
    } catch (e) {
      /* never break the frontend over eye candy */
    }
  };

  sweep();
  setInterval(sweep, 1500);
  window.addEventListener("location-changed", () => setTimeout(sweep, 300));
  console.info("%c AURORA-EFFECTS %c ready ", "background:#cba6f7;color:#11111b;font-weight:700", "background:#313244;color:#cdd6f4");
})();
