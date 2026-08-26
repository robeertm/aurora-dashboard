/*
 * Aurora Effects — tiny, dependency-free style helper for the Aurora dashboard.
 * v2.11.0 — cards in a grid fill their cell, so neighbours share one frame height.
 * v2.10.0 — the halo fades in instead of popping; scan spot on the curve.
 * v2.9.2 — the scan spot is back: a soft bright dot travels left to right
 *          across every trend, and the time axis picks its tick count from
 *          the card width so narrow tiles stay readable.
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
    /* Same idea, turned up: the ring on a lamp or socket tile sits on a busy
       tile next to a lit border and a glow, and at .55 peak on 2 px it simply
       did not read -- measured, it was there and animating correctly, it was
       just too faint to notice. Only opacity and reach change; the colour
       still comes from --aurora-glow, i.e. from the card. */
    @keyframes aurora-halo-strong {
      /* It has to FADE IN. Starting at .85 meant the ring appeared fully formed
         from one frame to the next — measured in a phone screen recording, the
         icon's brightness jumped by 11 of 255 in a single frame, three times in
         5.6 s, exactly 2.4 s apart. Everything else about the animation moved by
         less than 1.5 per frame. That one pop was the whole "jerky" impression.
         The pause at the end gives the pulse a breath between beats. */
      /* The card asks for ease-out, which is fastest at the START — exactly
         where the ring must be gentlest. Per-keyframe timing fixes that without
         touching the card: ease-in while it appears, ease-out as it travels. */
      0%       { transform: scale(.78);  opacity: 0;  animation-timing-function: ease-in-out; }
      22%      { transform: scale(.96);  opacity: .8; animation-timing-function: ease-out; }
      55%      { transform: scale(1.45); opacity: .3; }
      82%,100% { transform: scale(1.9);  opacity: 0; }
    }
    /* A compositor layer for the icons that ACTUALLY animate — never for all of
       them. will-change on every icon promoted 76 elements in a single room
       view to their own GPU layer; measured, that was the only source of
       dropped frames while scrolling (a 200 ms hitch, gone without it). */
    @media not all and ${MOBILE} {
      [style*="aurora-"], #img-cell::after { will-change: transform, opacity; }
    }
    /* Ring element; templates switch it on via --aurora-halo-anim. */
    #img-cell { position: relative; }
    #img-cell::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: 0 0 0 var(--aurora-halo-width, 2px) var(--aurora-glow, #f9e2af);
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
    /* This used to be a candle flicker on OPACITY: flat at 1, then a step down
       at 41->42% and again at 92%, driven with linear timing. Two problems.
       The steps read as a jump rather than a flicker, and -- because a lit
       light runs "aurora-breathe, aurora-flicker" and BOTH animated opacity --
       the later one in the list won the property outright. Measured on a lit
       icon: opacity sat at 1.00 for 2.6 s, then jumped 1.00 -> 0.66 in a
       single frame. That is what read as stuttering.
       It now moves SCALE instead. Breathe keeps opacity, flicker takes
       transform, so the two compose instead of fighting, both stay on the
       compositor (no repaint), and the motion is continuous rather than
       stepped. Amplitude is deliberately tiny (~1 px on a 28 px icon). */
    @keyframes aurora-flicker {
      0%   { transform: scale(1); }
      17%  { transform: scale(1.035); }
      33%  { transform: scale(.985); }
      52%  { transform: scale(1.045); }
      68%  { transform: scale(.99); }
      84%  { transform: scale(1.02); }
      100% { transform: scale(1); }
    }
    /* Idle decoration is off EVERYWHERE, not just on phones. A floating or
       shimmering icon says nothing about the house, and a room view holds ~50
       of them — measured, they were half of the CPU spent while scrolling
       (17 % → 7 %). Animations that MEAN something all keep running: a light
       that is on breathes and wears its halo, a low battery blinks, an open
       window pulses, an open valve spins, an active automation wobbles. */
    [style*="aurora-float"], [style*="aurora-swing"],
    [style*="aurora-bob"], [style*="aurora-shimmer"] {
      animation: none !important;
    }
    /* The scene used to be frozen outright on a phone. That killed exactly the
       thing people notice -- drifting clouds, the turning sun -- to save
       something that turns out not to cost much: measured in a phone-sized
       WebKit window, 60 fps frozen vs 58.6 fps with the whole scene running on
       the overview and 59.7 on the heaviest room view. Phone cards carry no
       backdrop-filter either, so nothing behind them is re-blurred per frame.
       What stays off here are the particle swarms. Rain, snow, falling leaves
       and fireflies are not one element each -- in bad weather they are dozens,
       each with its own animation, and a phone GPU is still a phone GPU. The
       big, slow motions cost a handful of composited layers; the swarms scale
       with the weather. Note this is a headless measurement on desktop
       hardware, so it bounds the layout cost, not the GPU cost of a real
       handset. */
    @media ${MOBILE} {
      .sky { transform: translateZ(0); }
      .rain, .snow, .leaf, .firefly, .flash,
      .rain *, .snow *, .fogband { animation: none !important; }
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
      z-index: 1;
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
  // Safari / iOS get the phone treatment at ANY window size. WebKit does not
  // composite `backdrop-filter` the way Blink does: with a full-screen backdrop
  // behind them, every blurred card is re-resolved while scrolling, and a room
  // view has ~90 of them. Measured by the person using it: Chrome and Edge
  // smooth, Safari unusable, and the companion app on iOS is WebKit too.
  // Chromium also reports AppleWebKit in its UA, hence the negative test.
  const WEBKIT = (() => {
    try {
      const ua = navigator.userAgent || "";
      return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg\/|OPR\//.test(ua);
    } catch (e) {
      return false;
    }
  })();
  const GLASS_WEBKIT = `
    ha-card {
      position: relative;
      z-index: 1;
      background-color: rgba(30,31,48,0.86);
      transition: border-color .3s ease;
    }
    ha-card::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      background: linear-gradient(125deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 30%, transparent 55%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
    }
  `;
  // The sky is a full-screen fixed layer. Blink keeps it on the compositor by
  // itself; WebKit repaints it with the page unless it is promoted explicitly.
  //
  // It used to be frozen here as well ("motion not worth a repaint"). That was
  // too blunt: every one of the scene's animations moves transform or opacity
  // only, and in WebKit the cards carry no backdrop-filter (see GLASS_WEBKIT),
  // so nothing behind them has to be re-blurred per frame -- the reason that
  // made an animated backdrop expensive in the first place does not apply here.
  // Measured on WebKit with the scene running: no change on the overview
  // (59 fps before and after) and none on the heaviest room view either.
  // The promotion below is what makes that true, so it stays.
  const SKY_WEBKIT = `
    .sky { transform: translateZ(0); }
    .sky * { will-change: transform, opacity; }
  `;
  // Cards nested inside stack-in-card sit ON their parent's glass surface, so
  // they need no blur of their own — and a second backdrop-filter per segment
  // is one of the most expensive things a browser can be asked to composite.
  const GLASS_INNER = `
    ha-card { background: transparent; position: relative; z-index: 1; }
    @media ${MOBILE} { ha-card { background-color: transparent; } }
  `;
  // Karten in einem Raster fuellen ihre Zelle. HA streckt die Rasterzellen
  // bereits auf die Zeilenhoehe (gemessen: Zelle 408 px), nur die Glaskarte
  // darin blieb bei ihrer Inhaltshoehe (332 px) stehen — daher die ungleich
  // hohen Rahmen nebeneinander. Zwei Zeilen genuegen; die Zeilenhoehe rechnet
  // weiterhin das Raster aus, unabhaengig von Spaltenzahl und Fensterbreite.
  const FILL = `
    ha-card { height: 100%; box-sizing: border-box; }
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

  // mini-graph-card draws the per-room trends. Give its line the same neon feel
  // the chart tiles had before: a thin stroke and a soft, STATIC glow. Static is
  // the whole point — an animated filter would repaint the card every frame.
  // mini-graph-card draws the per-room trends. Give its line the same neon feel
  // the chart tiles had before: a thin stroke and a soft, STATIC glow. Static is
  // the whole point — an animated filter would repaint the card every frame.
  // The card itself has no grid and no time axis, so both are added here: the
  // grid as a pure CSS background (painted once, costs nothing to scroll) and
  // the time axis as one row of labels derived from `hours_to_show`.
  const SKY_LAYER = `
    .sky { z-index: 0; }
    ha-card:has(.sky) { z-index: 0 !important; background: none !important; }
  `;

  const MINI = `
    .graph__container__svg svg { filter: drop-shadow(0 0 2.5px rgba(180,190,254,0.45)); }
    path.line { stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
    .graph__legend { font-size: 11px; letter-spacing: .02em; opacity: .85; }
    .graph__container__svg {
      background-image:
        repeating-linear-gradient(to right, rgba(180,190,254,.11) 0 1px, transparent 1px 25%),
        repeating-linear-gradient(to top,   rgba(180,190,254,.11) 0 1px, transparent 1px 25%);
      background-position: left bottom;
    }
    .graph__labels.--secondary, .graph__labels { font-size: 10px !important; opacity: .75; }
    /* The scan dot rides ON the curve, the way the house cockpit draws it.
       It is a real little circle moved along the line by SVG <animateMotion> —
       NOT a stroke-dashoffset animation on a copy of the path. That was the
       obvious way and it was measured at 60 -> 6 fps on a room view: shifting a
       dash repaints the whole curve every frame, while a moving circle only
       repaints its own few pixels. */
    /* No glow around it. Measured on a room view: plain dot 57.6 fps, dot with
       a pale halo circle 51.6, dot with a drop-shadow 50.8 — against 60.4 with
       no dot at all. A thin bright rim gives it presence for free instead. */
    g.aurora-scandot { pointer-events: none; }
    g.aurora-scandot circle {
      stroke: rgba(205,214,244,.9);
      stroke-width: 1;
      paint-order: stroke;
    }
    /* …and it gets its OWN transparent svg on top of the chart. Sharing the
       chart's svg cost 60 -> 39 fps on a room view, because every step of the
       motion invalidated that whole gradient-filled drawing. On a layer of its
       own only the dot's few pixels are ever repainted. */
    .graph__container__svg { position: relative; }
    svg.aurora-scanlayer {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
      pointer-events: none;
      will-change: transform;
    }
    /* Out of view it is simply not drawn — SMIL ignores animation-play-state. */
    ha-card.aurora-offscreen g.aurora-scandot { display: none; }
    @media (prefers-reduced-motion: reduce) { g.aurora-scandot { display: none; } }

    .aurora-xaxis {
      display: flex;
      width: 100%;
      box-sizing: border-box;
      justify-content: space-between;
      padding: 2px 8px 6px 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      letter-spacing: .04em;
      color: var(--secondary-text-color, #a6adc8);
      opacity: .8;
      pointer-events: none;
      white-space: nowrap;
    }
  `;

  // One row of time ticks under the graph: -h ... now. Written once per card and
  // re-checked on the regular sweep, because the card rebuilds its own DOM.
  const xLabel = (h, frac) => {
    const back = h * (1 - frac);
    if (back <= 0.01) return "jetzt";
    if (h > 48) {
      const d = back / 24;
      return "−" + (d >= 10 ? Math.round(d) : d.toFixed(d % 1 ? 1 : 0)) + " d";
    }
    return "−" + (back >= 10 ? Math.round(back) : back.toFixed(back % 1 ? 1 : 0)) + " h";
  };
  const addAxis = (el, sr) => {
    try {
      const box = sr.querySelector(".graph");
      if (!box || box.querySelector(".aurora-xaxis")) return;
      const cfg = el.config || el._config || {};
      const h = Number(cfg.hours_to_show) || 24;
      const row = document.createElement("div");
      row.className = "aurora-xaxis";
      // Narrow tiles (the sensor explorer packs two per row) cannot hold five
      // ticks — they wrap and turn into two lines of noise. Pick by width.
      const w = box.getBoundingClientRect().width || 400;
      const ticks = w < 210 ? 1 : w < 330 ? 2 : 4;
      for (let i = 0; i <= ticks; i++) {
        const s = document.createElement("span");
        s.textContent = xLabel(h, i / ticks);
        row.appendChild(s);
      }
      box.appendChild(row);
    } catch (e) {
      /* eye candy only */
    }
  };

  // One extra path per trend, holding the scan dot. It is a copy of the line's
  // own `d`, so the dot follows every bend. Recomputed only when the curve
  // actually changed, and skipped entirely while the card is off screen —
  // getTotalLength() forces layout and there are hundreds of these.
  const SVGNS = "http://www.w3.org/2000/svg";
  const addScan = (el, sr) => {
    try {
      const karte = sr.querySelector("ha-card");
      if (karte && karte.classList.contains("aurora-offscreen")) return;
      const orig = sr.querySelector("path.line");
      if (!orig) return;
      const svg = orig.ownerSVGElement;
      const d = orig.getAttribute("d");
      // The line itself lives inside an SVG <mask>; anything placed next to it
      // would only brighten the mask. The dot belongs on the svg root, which
      // shares the very same coordinate system.
      if (!svg || !d || d.length < 8) return;
      const box = svg.parentNode;
      let layer = box.querySelector(":scope > svg.aurora-scanlayer");
      if (!layer) {
        layer = document.createElementNS(SVGNS, "svg");
        layer.setAttribute("class", "aurora-scanlayer");
        layer.setAttribute("preserveAspectRatio", svg.getAttribute("preserveAspectRatio") || "none");
        box.appendChild(layer);
      }
      const vb = svg.getAttribute("viewBox");
      if (vb && layer.getAttribute("viewBox") !== vb) layer.setAttribute("viewBox", vb);
      let dot = layer.querySelector(":scope > g.aurora-scandot");
      if (!dot) {
        dot = document.createElementNS(SVGNS, "g");
        dot.setAttribute("class", "aurora-scandot");
        const c = document.createElementNS(SVGNS, "circle");
        c.setAttribute("r", "3");
        c.setAttribute("cx", "0");
        c.setAttribute("cy", "0");
        dot.appendChild(c);
        const m = document.createElementNS(SVGNS, "animateMotion");
        m.setAttribute("dur", "6s");
        m.setAttribute("repeatCount", "indefinite");
        m.setAttribute("rotate", "0");
        dot.appendChild(m);
        layer.appendChild(dot);
      }
      const m = dot.querySelector("animateMotion");
      if (!m || m.getAttribute("path") === d) return;
      m.setAttribute("path", d);
      if (m.beginElement) m.beginElement();
      const cfg = el.config || el._config || {};
      const erste = (cfg.entities || [])[0] || {};
      const farbe = erste.color || cfg.line_color || "#b4befe";
      for (const c of dot.querySelectorAll("circle")) c.style.fill = farbe;
    } catch (e) {
      /* eye candy only */
    }
  };

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
    base: mkSheet(KEYFRAMES + IDLE + SKY_LAYER + (WEBKIT ? SKY_WEBKIT : "")),
    glass: mkSheet(WEBKIT ? GLASS_WEBKIT : GLASS),
    glassInner: mkSheet(GLASS_INNER),
    apex: mkSheet(APEX),
    mini: mkSheet(MINI),
    fill: mkSheet(FILL),
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
  const miniDone = new WeakSet();
  const glassDone = new WeakSet();
  const fillDone = new WeakSet();
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
    if (el.tagName === "MINI-GRAPH-CARD") {
      if (!miniDone.has(sr)) {
        miniDone.add(sr);
        adopt(sr, SHEETS.mini);
      }
      addAxis(el, sr);
      addScan(el, sr);
    }
    // Kachel im Raster: fuellt die Zelle, damit Nachbarn gleich hohe Rahmen haben
    if (el.tagName === "STACK-IN-CARD" && !fillDone.has(el)) {
      const zelle = el.parentNode;
      if (zelle && zelle.tagName === "HUI-CARD") {
        fillDone.add(el);
        el.style.height = "100%";
        adopt(sr, SHEETS.fill);
      }
    }
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
  console.info("%c AURORA-EFFECTS %c v2.11.0 ready (" + (WEBKIT ? "WebKit-Modus" : "Blink") + ") ", "background:#cba6f7;color:#11111b;font-weight:700", "background:#313244;color:#cdd6f4");
})();
