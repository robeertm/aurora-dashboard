/*
 * Aurora Effects — tiny, dependency-free style helper for the Aurora dashboard.
 *
 * Injects two things into shadow DOM (which plain themes cannot reach):
 *  1. Glass blur on every ha-card — only while the Aurora theme is active
 *     (gated by the theme variable `aurora-fx`).
 *  2. The scan-pulse animation on every apexcharts-card series named "scan"
 *     (a short bright dash travelling along the curve, mission-control style).
 *
 * Every rule below lives in ONE shared constructable stylesheet that is adopted
 * by each shadow root — never copied into it. A room view holds ~100 cards; a
 * per-root <style> copy meant ~400 kB of duplicated CSS the browser had to parse
 * and re-match on every style recalculation, which is what made views slow to
 * open on a phone. See "Performance notes" in the README.
 *
 * No card-mod required. © 2026 Robert Manuwald — use only, see LICENSE.
 */
(() => {
  // Phones get the same look minus the two things a mobile GPU cannot afford:
  // a backdrop blur per card (each one is its own compositing layer plus a
  // snapshot of everything behind it, at 3x device pixels) and a full-screen
  // animated sky underneath all of them, which forces every one of those
  // blurred layers to be recomputed on every frame.
  const MOBILE = "(max-width: 700px)";

  // Shared keyframe library. Adopted by every card shadow root so any
  // button-card template can reference these by name — a child template's
  // own `extra_styles` REPLACES its parent's, so keyframes defined in a
  // parent template would otherwise be lost.
  const KEYFRAMES = `
    /* The glow itself is STATIC and only its opacity breathes. Animating
       drop-shadow() (a paint property) re-rasterises the icon on every frame
       and, inside a card with backdrop-filter, the blur behind it too —
       measured at ~120 style recalculations per second in a room with several
       lights on. Opacity stays on the compositor and looks the same. */
    [style*="aurora-breathe"] {
      filter: drop-shadow(0 0 9px var(--aurora-glow,#89b4fa));
      will-change: opacity;
    }
    @keyframes aurora-breathe {
      0%,100% { opacity: .62; }
      50%     { opacity: 1; }
    }
    @keyframes aurora-pulse {
      0%,100% { transform: scale(1); opacity: 1; }
      50%     { transform: scale(1.22); opacity: .6; }
    }
    @keyframes aurora-spin { to { transform: rotate(360deg); } }
    /* The halo ring used to animate box-shadow. Painting a shadow inside a card
       that also has backdrop-filter forces the blur behind it to be recomputed
       on EVERY frame — measured at ~28% CPU for a single room. Now it is a
       static ring on a pseudo element, scaled and faded on the compositor. */
    @keyframes aurora-halo {
      0%       { transform: scale(.88); opacity: .55; }
      70%,100% { transform: scale(1.75); opacity: 0; }
    }
    /* Animated icons get their own compositor layer. Without this, every frame
       of an icon animation invalidates the backdrop-filter of the whole card
       behind it, which is what actually costs the CPU. On a phone there is no
       backdrop-filter to protect and a layer per icon is GPU memory we do not
       have, so this is desktop-only. */
    @media not all and ${MOBILE} {
      ha-icon, ha-state-icon, ha-svg-icon, #img-cell::after {
        will-change: transform, opacity;
      }
    }
    /* Ring element; templates switch it on via --aurora-halo-anim. */
    #img-cell { position: relative; }
    #img-cell::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: 0 0 0 2px var(--aurora-glow, #f9e2af);
      opacity: 0;
      animation: var(--aurora-halo-anim, none);
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
    /* opacity/transform only — animating filter() forces a style recalc and a
       repaint on every frame, and scene grids can hold dozens of these. */
    @keyframes aurora-shimmer {
      0%,100% { opacity: .6; transform: scale(1); }
      50%     { opacity: 1; transform: scale(1.06); }
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
    /* The sky keeps its picture on a phone — sun, moon, clouds, meadow, the
       whole scene — but stops moving. A full-screen animated layer under
       translucent cards is the single most expensive thing on a mobile GPU.
       Idle decoration stops too: a floating icon says nothing, and 24 of them
       measured ~24 % CPU on their own. What an animation actually MEANS stays:
       a low battery still blinks, an open window still pulses, the halo still
       marks a light that is on, a valve still spins. */
    @media ${MOBILE} {
      .sky, .sky *, .sky::before, .sky::after { animation: none !important; }
      ha-icon[style*="aurora-float"], ha-icon[style*="aurora-swing"],
      ha-icon[style*="aurora-bob"], ha-icon[style*="aurora-shimmer"],
      ha-state-icon[style*="aurora-float"], ha-state-icon[style*="aurora-swing"],
      ha-state-icon[style*="aurora-bob"], ha-state-icon[style*="aurora-shimmer"],
      [style*="aurora-float"], [style*="aurora-swing"],
      [style*="aurora-bob"], [style*="aurora-shimmer"] {
        animation: none !important;
      }
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
    /* No blur on phones — a slightly more opaque card keeps the text readable
       over a bright sky without asking the GPU to blur the backdrop per card. */
    @media ${MOBILE} {
      ha-card {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        background-color: rgba(30,31,48,0.86);
      }
    }
  `;
  // Cards nested inside stack-in-card sit ON their parent's glass surface, so
  // they need no blur of their own — and a second backdrop-filter per segment
  // is one of the most expensive things a browser can be asked to composite.
  const GLASS_INNER = `
    ha-card { background: transparent; }
    @media ${MOBILE} { ha-card { background-color: transparent; } }
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
    @media ${MOBILE} {
      .apexcharts-series[seriesName="scan"] path { animation: none; visibility: hidden; }
    }
    @media (prefers-reduced-motion: reduce) {
      .apexcharts-series[seriesName="scan"] path {
        animation: none;
        visibility: hidden;
      }
    }
  `;

  // Section headings are plain light text sitting directly on the background.
  // The sky can be bright (a sunny day, a snow-covered meadow), so give them a
  // soft dark shadow — cheap insurance that costs nothing to paint once.
  const HEADING = `
    .heading, .heading *, h1, h2, .title, .subtitle {
      text-shadow: 0 1px 3px rgba(9,9,16,.55), 0 0 14px rgba(9,9,16,.35);
    }
  `;

  // Animations outside the viewport still cost paint/composite every frame.
  // Pause them per card and let an IntersectionObserver switch them back on.
  const IDLE = `
    ha-card.aurora-offscreen *,
    ha-card.aurora-offscreen::before,
    ha-card.aurora-offscreen::after { animation-play-state: paused !important; }
  `;

  // One CSSStyleSheet object per rule set, shared by every shadow root that
  // needs it. Adopting costs a pointer; copying cost kilobytes per card.
  const canAdopt = (() => {
    try {
      const s = new CSSStyleSheet();
      s.replaceSync(":host{}");
      return "adoptedStyleSheets" in Document.prototype || "adoptedStyleSheets" in ShadowRoot.prototype;
    } catch (e) {
      return false;
    }
  })();
  const mkSheet = (css) => {
    if (!canAdopt) return css;
    const s = new CSSStyleSheet();
    s.replaceSync(css);
    return s;
  };
  const SHEETS = {
    base: mkSheet(KEYFRAMES + IDLE),
    glass: mkSheet(GLASS),
    glassInner: mkSheet(GLASS_INNER),
    apex: mkSheet(APEX),
    heading: mkSheet(HEADING),
  };
  const adopt = (sr, ...sheets) => {
    if (!canAdopt) {
      const s = document.createElement("style");
      s.textContent = sheets.join("\n");
      sr.appendChild(s);
      return;
    }
    const have = sr.adoptedStyleSheets || [];
    const add = sheets.filter((s) => !have.includes(s));
    if (add.length) sr.adoptedStyleSheets = have.concat(add);
  };

  const seen = new WeakSet();
  const io = ("IntersectionObserver" in window)
    ? new IntersectionObserver((entries) => {
        for (const e of entries) e.target.classList.toggle("aurora-offscreen", !e.isIntersecting);
      }, { rootMargin: "250px 0px" })
    : null;

  const applyCols = (root, w) => {
    const info = baseCols.get(root);
    if (!info || !w) return;
    const cols = Math.max(1, Math.min(info.cols, Math.floor(w / info.min)));
    if (root.dataset.auroraCols !== String(cols)) {
      root.dataset.auroraCols = String(cols);
      root.style.gridTemplateColumns = "repeat(" + cols + ", minmax(0, 1fr))";
    }
  };
  const ro = ("ResizeObserver" in window)
    ? new ResizeObserver((entries) => {
        for (const e of entries) applyCols(e.target, e.contentRect.width);
      })
    : null;

  const apexDone = new WeakSet();
  const glassDone = new WeakSet();
  const headingDone = new WeakSet();
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
        adopt(sr, SHEETS.apex);
      }
      for (const li of sr.querySelectorAll(".apexcharts-legend-series")) {
        if (li.textContent.trim().toLowerCase().startsWith("scan")) li.style.display = "none";
      }
    }
    // Responsive: Spaltenzahl aus der TATSAECHLICHEN Breite ableiten statt aus
    // Breakpoints — ein Grid in einer schmalen Innenspalte ist genauso eng wie
    // eines auf dem Handy, und feste Media Queries sehen den Unterschied nicht.
    // Die Breite liefert ein ResizeObserver (kein erzwungenes Layout, und er
    // meldet sich auch, wenn die Karte erst spaeter ihre echte Breite bekommt).
    if (el.tagName === "HUI-GRID-CARD") {
      const root = sr.querySelector("#root");
      if (root && root.children.length && !baseCols.has(root)) {
        baseCols.set(root, {
          cols: getComputedStyle(root).gridTemplateColumns.split(" ").length,
          min: deepHas(root, 4) ? 300 : 132,
        });
        if (ro) ro.observe(root);
        else applyCols(root, root.getBoundingClientRect().width);
      }
    }
    if (el.tagName === "HUI-HEADING" && !headingDone.has(sr)) {
      headingDone.add(sr);
      adopt(sr, SHEETS.heading);
    }
    // Theme var may arrive late — keep re-checking until adopted.
    const card = sr.querySelector("ha-card");
    if (card && !glassDone.has(sr) && auroraActive(el)) {
      glassDone.add(sr);
      adopt(sr, SHEETS.base, insideStack(el) ? SHEETS.glassInner : SHEETS.glass);
    }
    if (io && card && !seen.has(card)) {
      seen.add(card);
      io.observe(card);
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
  setInterval(sweep, 4000);
  window.addEventListener("location-changed", () => setTimeout(sweep, 300));
  console.info("%c AURORA-EFFECTS %c v2.1.0 ready ", "background:#cba6f7;color:#11111b;font-weight:700", "background:#313244;color:#cdd6f4");
})();
