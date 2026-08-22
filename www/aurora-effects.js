/*
 * Aurora Effects — tiny, dependency-free style helper for the Aurora dashboard.
 *
 * Injects two things into shadow DOM (which plain themes cannot reach):
 *  1. Glass blur on every ha-card — only while the Aurora theme is active
 *     (gated by the theme variable `aurora-fx`).
 *  2. The scan-pulse animation on every apexcharts-card series named "scan"
 *     (a short bright dash travelling along the curve, mission-control style).
 *
 * No card-mod required. MIT licensed.
 */
(() => {
  const GLASS = `
    ha-card {
      backdrop-filter: blur(14px) saturate(1.2);
      -webkit-backdrop-filter: blur(14px) saturate(1.2);
      transition: border-color .3s ease, box-shadow .3s ease;
    }
    ha-card:hover {
      border-color: rgba(180,190,254,.22);
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
  const gridDone = new WeakSet();

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
    // Responsive: feste Grid-Spalten auf schmalen Screens reduzieren.
    if (el.tagName === "HUI-GRID-CARD" && !gridDone.has(sr)) {
      const root = sr.querySelector("#root");
      if (root && root.children.length) {
        const cols = getComputedStyle(root).gridTemplateColumns.split(" ").length;
        let css;
        if (deepHas(root, 4)) {
          css = "@media (max-width: 900px) { #root { grid-template-columns: repeat(1, minmax(0,1fr)) !important; } }";
        } else {
          const mid = Math.min(cols, 3);
          const small = Math.min(cols, 2);
          css = "@media (max-width: 900px) { #root { grid-template-columns: repeat(" + mid + ", minmax(0,1fr)) !important; } }" +
                "@media (max-width: 600px) { #root { grid-template-columns: repeat(" + small + ", minmax(0,1fr)) !important; } }";
        }
        gridDone.add(sr);
        inject(sr, css);
      }
    }
    // Theme var may arrive late — keep re-checking until injected.
    if (!glassDone.has(sr) && sr.querySelector("ha-card") && auroraActive(el)) {
      glassDone.add(sr);
      inject(sr, GLASS);
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
