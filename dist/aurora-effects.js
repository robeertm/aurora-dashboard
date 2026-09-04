/*
 * Aurora Effects — tiny, dependency-free style helper for the Aurora dashboard.
 * v2.26.0 — closing the sheet no longer sets off whatever is underneath it.
 *            A tap produces its mouse events LATER than the pointer ones, so
 *            removing the sheet during pointerup handed that trailing click to
 *            the card below - which then toggled. The sheet now stays on as an
 *            invisible shield while it fades out, catches those events itself,
 *            and only then leaves. Measured before and after: mousedown,
 *            mouseup and click each arrived once below, now none do.
 * v2.25.0 — the same tap layer also carries navigation: an element marked
 *            `data-aurora-nav="/path"` jumps there. The view titles use it
 *            for a "back to the overview" chip, so every tab has a way home
 *            that does not depend on the tab bar being reachable.
 * v2.24.0 — the sheet opens every time, not just once per app start: the
 *            row is no longer opened by the synthesised `click` but by the
 *            pointer sequence itself (pointerdown + pointerup, with a
 *            tap-versus-swipe test), so WebKit's click synthesis is out of
 *            the path. Closing no longer rips a FOCUSED element out of the
 *            document - the documented way to leave iOS without a focused
 *            document, after which taps stop arriving. The sheet also has
 *            an ✕ that is always in reach, and a bad payload now warns in
 *            the console instead of failing silently.
 * v2.23.0 — the detail sheet reaches the phone: iOS only synthesises a click
 *            for elements it considers clickable, and a listener on `document`
 *            does not make one. The rows now carry an `onclick` that calls
 *            `window.auroraDetail(this)`. The sheet is also a size smaller on
 *            a phone, and box-sizing keeps it inside the screen - measured at
 *            422 px wide on a 390 px screen before.
 * v2.22.0 — the "x things need you" rows can be opened: any card may mark
 *            an element with data-aurora-detail and one delegated listener
 *            opens a sheet explaining the finding and what to do about it.
 *            The sheet lives in <body>, not in the card - a button-card
 *            re-renders on every trigger entity, which would tear an in-card
 *            panel down while it is being read. Enter and Space work too,
 *            because the rows carry role="button".
 * v2.21.0 — rain and snow keep moving on a phone. Freezing them read as a
 *            fault (motion for a moment, then still); the scene now halves
 *            the number of drops on a small screen instead.
 * v2.20.0 — snow gets the same treatment as rain: single flakes that
 *            tumble down and settle, so .snowlane's pseudo elements join
 *            the phone switch-off.
 * v2.19.0 — real rain: the drop layer is no longer one gradient of slanted
 *            lines but single drops on their own tracks, so the phone switch
 *            has to name .rainlane's ::before and ::after — turning the
 *            element off leaves pseudo-element animations running.
 * v2.18.0 — daily-bar values step aside on a phone: the labels over the bars
 *            are hidden below 700 px, where 14 to 30 of them would overlap.
 * v2.17.0 — the grid is right in the FIRST paint: the card's own column rule
 *            gets a phone fallback, so no observer has to find it first.
 * v2.16.0 — build-up is picked up at once, and a minimum width
 *            catches up when a wide card loads late: during build-up new
 *            cards are picked up at once instead of at the next 4 s pass.
 * v2.15.0 — a grid ignores cards it does not size: a hidden conditional card
 *            no longer costs the row an empty column.
 * v2.14.0 — small screens: a tile keeps a readable width, and a tile whose
 *            text needs more room grows instead of clipping it.
 * v2.13.0 — a part-filled last row is stretched to fill, but only where every
 *            card in it keeps the same width.
 * v2.12.0 — a grid never uses more columns than it has cards, so a row is
 *            never left part empty.
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

  // Auf dem Handy braucht eine Kachel mehr Breite als auf dem Schreibtisch.
  // Gemessen auf einem 430-px-Bildschirm: mit der Schreibtisch-Mindestbreite
  // passen drei Kacheln nebeneinander (133 px) — dort bleibt vom Namen
  // "Heizungsthermostat Arbeitszimmer Batterie" nur "Heizungsth…", und der
  // Wert darueber wird oben abgeschnitten. Mit 176 px werden es zwei Kacheln,
  // und der Name steht vollstaendig da. Der Bildschirm scrollt ohnehin.
  const KACHEL_MIN_HANDY = 176;
  const istHandy = () => {
    try {
      return window.matchMedia(MOBILE).matches;
    } catch (e) {
      return false;
    }
  };

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
       each with its own animation, and a phone GPU is still a phone GPU. Rain
       drops carry their animation on ::before and ::after, so those pseudo
       elements have to be named explicitly -- switching the element off does
       not switch them off. The
       big, slow motions cost a handful of composited layers; the swarms scale
       with the weather. Note this is a headless measurement on desktop
       hardware, so it bounds the layout cost, not the GPU cost of a real
       handset.

       Rain and snow are NOT frozen here any more. Freezing them looked like a
       fault: the card animates on its first paint from its own styles, and the
       motion died a moment later when this sheet was adopted -- read as "it
       runs briefly and then hangs". They stay in motion and the scene halves
       the number of drops on a phone instead, so the cost is bounded by count
       rather than by switching the whole thing off. */
    @media ${MOBILE} {
      .sky { transform: translateZ(0); }
      .leaf, .firefly, .flash, .fogband { animation: none !important; }
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
    /* A daily-bar chart writes its value above every bar. On a phone a bar is
       only a few pixels wide, and 14 to 30 bars of similar height stack their
       labels on top of each other. There the shape is what counts: the total
       stays in the card header, the single value in the tooltip.
       apexcharts' own \`responsive\` option is NOT an alternative — it replaces
       the whole dataLabels object including the formatter apexcharts-card
       installs at runtime, and the card then throws and stays on its spinner. */
    @media ${MOBILE} {
      .apexcharts-datalabels { display: none; }
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
    if (!info) return;
    if (w) info.w = w;
    if (!info.w) return;
    // Nie mehr Spalten als Karten. Zwei Karten in einem Dreierraster liessen
    // sonst ein Drittel der Zeile leer (gemessen: 421+421 px in 1280 px), eine
    // einzelne Karte in einem Zweierraster sogar die Haelfte. Die Karten bleiben
    // dabei untereinander gleich breit — es faellt nur die leere Spur weg.
    const frei = freieKinder(root);
    // Raster, in dem HA jede Breite selbst vergibt: Spaltenzahl unveraendert.
    const n = frei.length || info.cols;
    const min = istHandy() ? Math.max(info.min, KACHEL_MIN_HANDY) : info.min;
    const cols = Math.max(1, Math.min(info.cols, n, Math.floor(info.w / min)));
    if (root.dataset.auroraCols !== String(cols)) {
      root.dataset.auroraCols = String(cols);
      root.style.gridTemplateColumns = "repeat(" + cols + ", minmax(0, 1fr))";
    }
    fuelleLetzteZeile(root, cols, frei);
  };

  // Angebrochene letzte Zeile auffuellen — aber NUR, wenn dabei alle Karten der
  // Zeile gleich breit bleiben, also wenn die Spaltenzahl durch die Restzahl
  // teilbar ist (2 Spalten/1 Rest -> volle Breite, 4/2 -> je die Haelfte).
  // Bei 3 Spalten und 2 Resten waere eine Karte 1,5 Spuren breit — dann lieber
  // die Rasterbreite behalten, sonst ist eine Karte breiter als die daneben.
  // Die Karten, deren Breite dieses Raster ueberhaupt vergibt. Zwei Sorten
  // zaehlen NICHT mit:
  //  · Karten, deren Spaltenbreite Home Assistant selbst setzt (volle Breite) —
  //    sie belegen ohnehin die ganze Zeile.
  //  · bedingte Karten, die gerade unsichtbar sind. HA setzt auf ihrer hui-card
  //    das Attribut `hidden` (und display:none), sie belegen also keine Zelle.
  //    Mitgezaehlt fuehrten sie zu einer Spalte zu viel: die Uebersicht stellte
  //    Uhr und Kachelblock in ein Dreierraster und liess die dritte Spur leer
  //    (gemessen 516 + 516 px, 516 px Loch) — genau die Luecke im Tab.
  // `hidden` ist ein Attribut, die Pruefung kostet also weder Stil- noch
  // Layout-Berechnung.
  const freieKinder = (root) => {
    const frei = [];
    for (const el of root.children) {
      if (!("auroraSpanFrei" in el.dataset)) {
        el.dataset.auroraSpanFrei = el.style.gridColumn ? "0" : "1";
      }
      if (el.dataset.auroraSpanFrei !== "1") continue;
      if (el.hidden) continue;
      frei.push(el);
    }
    return frei;
  };

  const fuelleLetzteZeile = (root, cols, frei) => {
    const n = frei.length;
    const rest = n % cols;
    const span = (rest && cols % rest === 0) ? cols / rest : 1;
    for (let i = 0; i < n; i++) {
      const el = frei[i];
      const soll = (span > 1 && i >= n - rest) ? "span " + span : "";
      if (el.style.gridColumn !== soll) el.style.gridColumn = soll;
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
    // Kachel mit fester Hoehe: braucht der Text mehr Platz, waechst sie mit,
    // statt ihn abzuschneiden. Gemessen auf einem 430-px-Bildschirm: sieben
    // Kacheln im System-Tab schoben ihren Wert oben aus dem Rahmen heraus.
    // Aus der festen Hoehe wird eine Mindesthoehe — kurze Kacheln bleiben
    // also exakt so hoch wie bisher —, und "height: 100%" haelt die Nachbarn
    // in derselben Zeile auf gleicher Hoehe (dieselbe Regel wie v2.11.0).
    // button-card schreibt die Hoehe als Inline-Stil; danach steht dort
    // "100%", die Umstellung passiert je Render also genau einmal.
    if (el.tagName === "BUTTON-CARD") {
      const kachel = sr.querySelector("ha-card");
      if (kachel && kachel.style.height.endsWith("px")) {
        kachel.style.minHeight = kachel.style.height;
        kachel.style.height = "100%";
        el.style.height = "100%";
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
      if (root && root.children.length) {
        if (!baseCols.has(root)) {
          baseCols.set(root, {
            cols: getComputedStyle(root).gridTemplateColumns.split(" ").length,
            min: deepHas(root, 4) ? 300 : 132,
          });
          if (ro) ro.observe(root);
          else applyCols(root, root.getBoundingClientRect().width);
        } else {
          // Eine breite Karte (Uhr, Diagramm, stack-in-card) kann NACH dem
          // Registrieren dazukommen — custom cards werden spaeter geladen. Dann
          // stimmt die einmal gemerkte Mindestbreite nicht mehr: das Raster
          // stellte Uhr und Kachelblock auf einem 414-px-Handy nebeneinander,
          // die Uhr also auf 207 px. Solange die Mindestbreite noch die kleine
          // ist, wird sie deshalb weiter nachgeprueft.
          const info = baseCols.get(root);
          if (info && info.min < 300 && deepHas(root, 4)) info.min = 300;
          // Kartenzahl kann sich geaendert haben (bedingte Karten, Nachladen).
          // Kostenlos: nutzt die gespeicherte Breite, liest kein Layout.
          applyCols(root, 0);
        }
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

  // Waehrend das Dashboard aufgebaut wird, reicht der 4-Sekunden-Takt nicht:
  // die Karten stehen dann bis zu vier Sekunden lang im Schreibtisch-Raster, auf
  // einem 414-px-Handy also z. B. sechs Kacheln nebeneinander (gemessen: bei
  // 800 ms noch 6 Spalten, korrigiert erst bei 1200 ms — auf einem echten
  // Telefon entsprechend spaeter). Deshalb hoert ein MutationObserver waehrend
  // der Aufbauphase zu und laesst neue Karten sofort mitlaufen. Er wird nach
  // sechs Sekunden Ruhe wieder abgeschaltet, damit im Betrieb nichts dauerhaft
  // an jeder DOM-Aenderung haengt — ein Dashboard voller button-cards baut sich
  // bei jeder Zustandsaenderung neu auf.
  let bremse = 0;
  let letzterLauf = 0;
  const baldSweepen = () => {
    if (bremse) return;
    const wartet = Math.max(0, 120 - (performance.now() - letzterLauf));
    bremse = setTimeout(() => {
      bremse = 0;
      letzterLauf = performance.now();
      sweep();
    }, wartet);
  };

  let aufbauEnde = 0;
  const beobachter = typeof MutationObserver === "function"
    ? new MutationObserver(baldSweepen)
    : null;
  const aufbauBeobachten = () => {
    if (!beobachter) return;
    clearTimeout(aufbauEnde);
    try {
      beobachter.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      return;
    }
    // 20 Sekunden: ein Dashboard laedt seine Karten in Wellen nach (custom
    // cards, Diagramme, alles ausserhalb des Bildschirms). Mit sechs Sekunden
    // fielen die spaeten Wellen wieder in den 4-Sekunden-Takt zurueck
    // (gemessen: bis 4003 ms falsches Raster). Danach ist Schluss, damit im
    // Betrieb nichts dauerhaft an jeder DOM-Aenderung haengt.
    aufbauEnde = setTimeout(() => beobachter.disconnect(), 20000);
  };

  // Damit das Raster schon im ERSTEN Bild stimmt und nicht erst, wenn der
  // Helfer die Karte gesehen hat: die Spaltenregel der Karte selbst ergaenzen.
  // Home Assistant rechnet die Spalten aus `--grid-card-column-count`, das es
  // je Karte inline setzt — auf einem Handy also die Schreibtisch-Zahl, bis
  // hier jemand eingreift. `hui-grid-card` ist eine Lit-Komponente: alle
  // Instanzen teilen dieselben Stylesheet-Objekte, ein einziger Eingriff wirkt
  // deshalb auf jede Karte, auch auf jede spaeter geladene — ohne dass ein
  // Beobachter sie erst finden muesste. Die Regel gilt nur, solange der Helfer
  // das Raster noch nicht angefasst hat (`data-aurora-cols`); danach gewinnt
  // wieder die feinere Rechnung aus applyCols.
  const grundregelEinbauen = () => {
    const K = customElements.get("hui-grid-card");
    if (!K || !K.elementStyles || K.auroraGrundregel) return;
    const regel = "@media " + MOBILE + " { #root:not([data-aurora-cols]) { " +
      "grid-template-columns: repeat(auto-fit, minmax(" + KACHEL_MIN_HANDY +
      "px, 1fr)) !important; } }";
    let gesetzt = false;
    for (const blatt of K.elementStyles) {
      const sh = blatt && blatt.styleSheet;
      if (!sh || !sh.cssRules) continue;
      let traegtRoot = false;
      for (const r of sh.cssRules) if (/#root/.test(r.cssText)) traegtRoot = true;
      if (!traegtRoot) continue;
      try {
        sh.insertRule(regel, sh.cssRules.length);
        gesetzt = true;
      } catch (e) {
        /* Blatt nicht beschreibbar — dann greift der Rueckfall unten */
      }
      break;
    }
    if (!gesetzt) {
      // Rueckfall: eigenes Blatt anhaengen. Lit adoptiert es dann in jede
      // Karte, die danach gebaut wird.
      try {
        const eigen = new CSSStyleSheet();
        eigen.replaceSync(regel);
        K.elementStyles = [...K.elementStyles, eigen];
        gesetzt = true;
      } catch (e) {
        /* dann bleibt es beim Nachziehen per JS */
      }
    }
    if (gesetzt) K.auroraGrundregel = true;
  };
  try {
    if (customElements.get("hui-grid-card")) grundregelEinbauen();
    else customElements.whenDefined("hui-grid-card").then(grundregelEinbauen, () => {});
  } catch (e) {
    /* never break the frontend over eye candy */
  }

  // ── Detail sheet ────────────────────────────────────────────────────
  // Any card may mark an element with data-aurora-detail='{"t":…}'. One
  // delegated listener opens a sheet that is appended to <body>, NOT into
  // the card: a button-card re-renders whenever one of its trigger
  // entities changes, which would tear an in-card panel down mid-read.
  //
  // Payload keys are short because the whole object travels inside an
  // HTML attribute: t=title, w=why, f=[fix steps], n=navigation target,
  // nl=label for that button, e=entity for the more-info dialog,
  // c=accent colour, s=subtitle.
  const SHEET_ID = "aurora-detail-sheet";
  const SHEET_CSS = `
    #${SHEET_ID}{position:fixed;inset:0;z-index:9999;display:grid;
      place-items:center;padding:16px;
      background:rgba(17,17,27,.62);backdrop-filter:blur(3px);
      animation:aurora-sheet-in .18s ease-out both}
    /* border-box, sonst kommt der Innenabstand auf die Breite OBEN DRAUF:
       gemessen 422 px auf einem 390-px-Bildschirm, das Blatt stand seitlich
       ueber. */
    #${SHEET_ID} .sheet{width:min(560px,100%);box-sizing:border-box;
      max-height:86vh;overflow:auto;
      /* The sheet hangs in <body>, outside HA's shadow trees - without an
         explicit stack it falls back to the browser default, which is a
         serif face. Found by looking at a screenshot, not by a test. */
      font-family:var(--primary-font-family,var(--paper-font-body1_-_font-family,
        system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif));
      background:#1e1e2e;color:#cdd6f4;border-radius:20px;
      border:1px solid rgba(205,214,244,.14);
      box-shadow:0 24px 60px rgba(0,0,0,.55);
      padding:22px 22px 18px;
      animation:aurora-sheet-rise .22s cubic-bezier(.2,.8,.3,1) both}
    #${SHEET_ID} .hd{display:flex;gap:12px;align-items:flex-start;margin-bottom:6px}
    #${SHEET_ID} .hd ha-icon{--mdc-icon-size:26px;flex:0 0 auto;margin-top:1px}
    #${SHEET_ID} .hd .txt{flex:1 1 auto;min-width:0}
    /* Ein Schliesskreuz, das immer in Reichweite ist: die Knopfreihe steht
       unter dem Text und kann bei einem langen Hinweis weggescrollt sein. */
    #${SHEET_ID} .x{flex:0 0 auto;margin:-6px -6px 0 0;padding:6px 9px;
      line-height:1;font-size:1.05rem;border:0;background:none;color:#a6adc8;
      border-radius:9px;cursor:pointer}
    #${SHEET_ID} .x:hover{background:rgba(205,214,244,.1);color:#cdd6f4}
    #${SHEET_ID} h2{margin:0;font-size:1.1rem;line-height:1.32;font-weight:700;
      font-family:ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.005em}
    #${SHEET_ID} .sub{margin:2px 0 0;font-size:.82rem;opacity:.62}
    #${SHEET_ID} .why{margin:14px 0 0;font-size:.93rem;line-height:1.5;opacity:.9}
    #${SHEET_ID} .fixh{margin:18px 0 8px;font-size:.74rem;letter-spacing:.09em;
      text-transform:uppercase;opacity:.55}
    #${SHEET_ID} ol{margin:0;padding-left:1.25em;font-size:.93rem;line-height:1.55}
    #${SHEET_ID} ol li{margin:0 0 6px}
    #${SHEET_ID} .btns{display:flex;flex-wrap:wrap;gap:9px;margin-top:20px}
    #${SHEET_ID} button{font:inherit;font-size:.9rem;font-weight:500;cursor:pointer;
      box-sizing:border-box;touch-action:manipulation;
      -webkit-tap-highlight-color:rgba(205,214,244,.18);
      border-radius:12px;padding:10px 16px;border:1px solid rgba(205,214,244,.16);
      background:rgba(205,214,244,.07);color:#cdd6f4;transition:background .15s}
    #${SHEET_ID} button:hover{background:rgba(205,214,244,.15)}
    #${SHEET_ID} button.go{background:var(--tone,#89b4fa);color:#11111b;
      border-color:transparent;font-weight:600}
    #${SHEET_ID} button.go:hover{filter:brightness(1.12)}
    #${SHEET_ID} button:focus-visible{outline:2px solid #89b4fa;outline-offset:2px}
    /* Ausblenden. Die Zeile animation:none ist noetig, weil die
       Einblend-Animation mit fill-mode both ihren Endzustand festhaelt und
       sonst jede Deckkraft hier ueberstimmt. Zeigerereignisse bleiben AN:
       das unsichtbare Blatt ist in dieser Zeit der Schild, der den
       nachlaufenden Klick abfaengt. (Kein Backtick in diesem Kommentar - er
       steht in einem Template-Literal und wuerde es beenden.) */
    #${SHEET_ID}.zu{animation:none;opacity:0;transition:opacity .2s ease;
      pointer-events:auto}
    #${SHEET_ID}.zu .sheet{animation:none;opacity:0;transform:translateY(8px);
      transition:opacity .2s ease,transform .2s ease}
    @media (prefers-reduced-motion:reduce){
      #${SHEET_ID}.zu,#${SHEET_ID}.zu .sheet{transition:none}}
    @keyframes aurora-sheet-in{from{opacity:0}to{opacity:1}}
    @keyframes aurora-sheet-rise{from{opacity:0;transform:translateY(14px) scale(.98)}
      to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){
      #${SHEET_ID},#${SHEET_ID} .sheet{animation:none}}
    /* Auf dem Telefon nimmt das Blatt sonst ein Drittel des Bildschirms ein.
       Alles eine Stufe kleiner, weniger Rand, flachere Knoepfe. */
    @media (max-width:700px){
      #${SHEET_ID}{place-items:end center;padding:0}
      #${SHEET_ID} .sheet{width:100%;max-height:78vh;border-radius:18px 18px 0 0;
        padding:15px 15px calc(13px + env(safe-area-inset-bottom))}
      #${SHEET_ID} .hd{gap:9px;margin-bottom:4px}
      #${SHEET_ID} .hd ha-icon{--mdc-icon-size:21px}
      #${SHEET_ID} .x{margin:-4px -4px 0 0;padding:5px 8px;font-size:1rem}
      #${SHEET_ID} h2{font-size:.96rem;line-height:1.28}
      #${SHEET_ID} .sub{font-size:.74rem}
      #${SHEET_ID} .why{margin-top:10px;font-size:.84rem;line-height:1.42}
      #${SHEET_ID} .fixh{margin:12px 0 5px;font-size:.67rem}
      #${SHEET_ID} ol{font-size:.84rem;line-height:1.42;padding-left:1.15em}
      #${SHEET_ID} ol li{margin-bottom:4px}
      #${SHEET_ID} .btns{gap:7px;margin-top:13px}
      #${SHEET_ID} button{padding:8px 13px;font-size:.83rem;border-radius:10px}}
  `;

  const escHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // HA's router listens for this pair; a plain <a href> would reload the app.
  const navigateTo = (path) => {
    try {
      history.pushState(null, "", path);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    } catch (e) {
      location.href = path;
    }
  };

  const openMoreInfo = (entityId) => {
    try {
      const root = document.querySelector("home-assistant");
      if (!root) return;
      root.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId }, bubbles: true, composed: true,
      }));
    } catch (e) {
      /* the sheet stays open, the reader loses nothing */
    }
  };

  // Ein Blatt zu schliessen heisst NICHT einfach `remove()`: liegt der Fokus
  // in dem Element, das aus dem Dokument fliegt, bleibt das Dokument auf dem
  // iPhone ohne Fokus zurueck - und danach kommt kein Tippen mehr an. Genau
  // genau das war der Befund vom Geraet: "klappt einmal, dann erst wieder
  // nach einem App-Neustart".
  // Also: erst den Fokus herausnehmen, dann entfernen. Und ueber ALLE Knoten
  // laufen, nicht nur ueber den ersten mit der Kennung.
  // Fenster, in dem die aus einer Beruehrung nachgereichten Mausereignisse
  // ankommen. Kuerzer als jede bewusste zweite Beruehrung, laenger als der
  // Nachlauf des Browsers.
  const GEIST_MS = 400;
  // So lange bleibt das geschlossene Blatt unsichtbar liegen und faengt ab.
  // Muss laenger sein als der Nachlauf des Browsers (gemessen: bis ~300 ms).
  const SCHILD_MS = 350;
  let letztesZu = 0;

  // Hartes Entfernen - fuer den Fall, dass sofort ein neues Blatt kommt.
  const entferneBlaetter = () => {
    for (const n of document.querySelectorAll("#" + SHEET_ID)) {
      const a = document.activeElement;
      if (a && a !== document.body && n.contains(a) && a.blur) {
        try { a.blur(); } catch (e) { /* Fokus ist Beiwerk */ }
      }
      n.remove();
    }
    document.removeEventListener("keydown", onSheetKey, true);
  };

  // `geist` = das Schliessen kam aus einer Zeiger-/Beruehrungsgeste, auf die
  // der Browser noch Mausereignisse nachreicht. Nur dann sperren - nach
  // Escape gibt es keinen Geisterklick, und eine Sperre wuerde dort nur den
  // naechsten ehrlichen Klick fressen (gemessen: Escape, dann Klick = nichts).
  // 🔴 NICHT sofort entfernen. Eine Beruehrung erzeugt ihre Mausereignisse
  //    SPAETER als die Zeigerereignisse: wer das Blatt waehrend `pointerup`
  //    aus dem Dokument nimmt, reicht `mousedown`/`mouseup`/`click` an die
  //    Karte darunter weiter - und die schaltet dann ("schliesse ich das
  //    Blatt, geht das darunterliegende Fenster auf").
  //    Nachgemessen vorher: je 1x mousedown, mouseup, click unten. Jetzt: 0.
  //    Das Blatt bleibt darum sichtbar ausgeblendet, aber weiter fangend
  //    liegen und geht erst danach.
  const closeSheet = (geist) => {
    const nodes = document.querySelectorAll("#" + SHEET_ID);
    if (geist && nodes.length) letztesZu = performance.now();
    document.removeEventListener("keydown", onSheetKey, true);
    for (const n of nodes) {
      if (n.dataset.zu) continue;                 // blendet schon aus
      const a = document.activeElement;
      if (a && a !== document.body && n.contains(a) && a.blur) {
        try { a.blur(); } catch (e) { /* Fokus ist Beiwerk, nie ein Grund zu scheitern */ }
      }
      n.dataset.zu = String(Date.now());
      n.__getan = 1;                              // nimmt selbst nichts mehr an
      n.classList.add("zu");
      setTimeout(() => { try { n.remove(); } catch (e) { /* schon weg */ } }, SCHILD_MS);
    }
  };

  // Sicherheitsnetz: im Hintergrund friert das Telefon Zeitgeber ein. Ein
  // Schild, dessen Zeitgeber nie feuert, wuerde alles abfangen - genau die
  // Art unsichtbares Overlay, hinter dem man den Fehler ewig sucht.
  const schildeAufraeumen = () => {
    const jetzt = Date.now();
    for (const n of document.querySelectorAll("#" + SHEET_ID + "[data-zu]")) {
      if (jetzt - Number(n.dataset.zu) > SCHILD_MS + 1000) n.remove();
    }
  };
  setInterval(schildeAufraeumen, 2000);
  document.addEventListener("visibilitychange", schildeAufraeumen);

  function onSheetKey(ev) {
    // Nach Escape gibt es keinen nachlaufenden Klick - also auch keinen Grund,
    // die Seite 350 ms lang abzuschirmen. Sofort weg.
    if (ev.key === "Escape") { ev.stopPropagation(); entferneBlaetter(); }
  }

  // Fokus ist eine Tastatur-Hilfe. Auf dem Telefon bringt er nichts, kann die
  // Seite verspringen lassen - und ist die halbe Miete des Fehlers oben.
  const zeigerGeraet = (() => {
    try { return window.matchMedia("(hover: hover) and (pointer: fine)").matches; }
    catch (e) { return false; }
  })();

  const openSheet = (d, mitFokus) => {
    entferneBlaetter();
    const tone = d.c || "#89b4fa";
    const wrap = document.createElement("div");
    wrap.id = SHEET_ID;
    wrap.innerHTML =
      `<style>${SHEET_CSS}</style>` +
      `<div class="sheet" role="dialog" aria-modal="true" style="--tone:${escHtml(tone)}">` +
        `<div class="hd">` +
          (d.i ? `<ha-icon icon="${escHtml(d.i)}" style="color:${escHtml(tone)}"></ha-icon>` : "") +
          `<div class="txt"><h2>${escHtml(d.t || "")}</h2>` +
          (d.s ? `<p class="sub">${escHtml(d.s)}</p>` : "") + `</div>` +
          `<button class="x" data-close="1" aria-label="Schließen">✕</button>` +
        `</div>` +
        (d.w ? `<p class="why">${escHtml(d.w)}</p>` : "") +
        (Array.isArray(d.f) && d.f.length
          ? `<div class="fixh">Was du tun kannst</div><ol>` +
            d.f.map((x) => `<li>${escHtml(x)}</li>`).join("") + `</ol>`
          : "") +
        `<div class="btns">` +
          (d.n ? `<button class="go" data-go="${escHtml(d.n)}">${escHtml(d.nl || "Hin da")}</button>` : "") +
          (d.e ? `<button data-mi="${escHtml(d.e)}">Gerät öffnen</button>` : "") +
          `<button data-close="1">Schließen</button>` +
        `</div>` +
      `</div>`;

    // Auch hier zaehlt der Zeiger, nicht der Klick: der Hintergrund ist ein
    // schlichtes div, und dafuer erzeugt WebKit nicht verlaesslich einen Klick.
    // `getan` sorgt dafuer, dass ein nachlaufender Klick nichts doppelt macht.
    const wirken = (ev) => {
      if (wrap.__getan) return;
      // 🔴 Geisterklick: das Blatt geht bei `pointerup` auf, und der Klick, den
      //    der Browser aus derselben Beruehrung NACHTRAEGLICH erzeugt, faellt
      //    dann schon auf den frisch entstandenen Hintergrund - der schliesst
      //    es im selben Wimpernschlag wieder. Ergebnis: es blitzt nur kurz auf.
      //    Gemessen im Ereignisprotokoll: pointerup [ZEILE] -> click [DIV].
      if (performance.now() - wrap.__geboren < GEIST_MS) return;
      const t = ev.target;
      const b = t && t.closest ? t.closest("button") : null;
      if (!b) {
        // Nur der Hintergrund schliesst - ein Tippen auf den Text nicht.
        if (t === wrap || (t && t.id === SHEET_ID)) { wrap.__getan = 1; closeSheet(true); }
        return;
      }
      wrap.__getan = 1;
      if (b.dataset.close) { closeSheet(true); return; }
      if (b.dataset.mi) { closeSheet(true); openMoreInfo(b.dataset.mi); return; }
      if (b.dataset.go) { closeSheet(true); navigateTo(b.dataset.go); }
    };
    wrap.addEventListener("pointerup", wirken);
    wrap.addEventListener("click", wirken);

    wrap.__geboren = performance.now();
    document.body.appendChild(wrap);
    document.addEventListener("keydown", onSheetKey, true);
    if (mitFokus || zeigerGeraet) {
      const first = wrap.querySelector("button.go") || wrap.querySelector("button.x");
      if (first) first.focus();
    }
  };

  // Capture-Phase + composedPath: die markierte Zeile liegt im Schatten-DOM
  // der Karte, wo ein gewoehnlicher Horcher am document sie nie zu sehen bekommt.
  const markedIn = (ev) => {
    const path = ev.composedPath ? ev.composedPath() : [];
    for (const el of path) {
      if (el && el.dataset && (el.dataset.auroraDetail || el.dataset.auroraNav)) return el;
      if (el === document) break;
    }
    return null;
  };

  // EIN Eingang fuer alle Wege (Zeiger, Klick, Tastatur, `onclick`-Attribut).
  // Liegt schon ein Blatt oben, passiert nichts - so kann derselbe Tipp nicht
  // ueber zwei Wege doppelt oeffnen.
  const openFrom = (el, mitFokus) => {
    if (document.getElementById(SHEET_ID)) return false;
    // Gerade erst zugemacht? Dann ist das hier der Geisterklick derselben
    // Beruehrung und kein neuer Wunsch.
    if (performance.now() - letztesZu < GEIST_MS) return false;
    let payload;
    try {
      payload = JSON.parse(el.dataset.auroraDetail);
    } catch (e) {
      // 🔴 Ein stiller catch macht aus einem Fehler ein Nichts-passiert.
      console.warn("[aurora] Detail-Nutzlast unlesbar:", e, el.dataset.auroraDetail);
      return false;
    }
    openSheet(payload, mitFokus);
    return true;
  };

  // Zwei Markierungen, ein Weg: `data-aurora-nav` springt, `data-aurora-detail`
  // klappt auf. Alles andere - Zeigerkette, Geisterklick-Sperre, Tastatur -
  // gilt fuer beide gleich.
  let letzteNav = 0;
  const actOn = (el, mitFokus) => {
    const ziel = el.dataset.auroraNav;
    if (ziel) {
      // Derselbe Tipp darf nicht zweimal in die Geschichte schreiben.
      if (performance.now() - letzteNav < GEIST_MS) return false;
      letzteNav = performance.now();
      closeSheet();
      navigateTo(ziel);
      return true;
    }
    return openFrom(el, mitFokus);
  };

  // ── Antippen ueber die Zeigerkette, nicht ueber den Klick ────────────────
  // WebKit erzeugt einen `click` nur fuer Elemente, die es fuer anklickbar
  // haelt - und selbst mit `onclick` blieb es auf dem iPhone beim ersten Mal.
  // Darum werten wir pointerdown/pointerup selbst aus. Ein Tippen ist kurz und
  // bleibt fast auf der Stelle; alles andere ist Wischen und wird verworfen -
  // sonst oeffnet jedes Scrollen, das auf einer Zeile beginnt, das Blatt.
  const TAP_SLOP = 12;     // px
  const TAP_MS = 900;      // laenger ist Halten
  const tip = { s: null, weg: 0 };

  const tipAn = (el, x, y) => { tip.s = { el, x, y, t: Date.now() }; tip.weg = 0; };
  const tipZieht = (x, y) => {
    if (!tip.s) return;
    tip.weg = Math.max(tip.weg, Math.abs(x - tip.s.x), Math.abs(y - tip.s.y));
  };
  const tipAus = (ev) => {
    const s = tip.s;
    if (!s || markedIn(ev) !== s.el) return;
    tip.s = null;
    if (Date.now() - s.t > TAP_MS) return;     // gehalten, kein Tippen
    if (tip.weg > TAP_SLOP) return;            // gewischt, also gescrollt
    ev.stopPropagation();
    actOn(s.el, false);
  };

  document.addEventListener("pointerdown", (ev) => {
    const el = markedIn(ev);
    if (el) tipAn(el, ev.clientX, ev.clientY); else tip.s = null;
  }, true);
  document.addEventListener("pointermove", (ev) => tipZieht(ev.clientX, ev.clientY), true);
  document.addEventListener("pointerup", tipAus, true);
  // 🔴 `pointercancel` NICHT als Abbruch werten: der Browser schickt es, sobald
  //    er sich das Scrollen offenhaelt - bei einem gewoehnlichen Tippen auf eine
  //    Zeile ohne `touch-action: manipulation` also fast immer. Wer hier den
  //    Merker loescht, hat einen Knopf gebaut, der nie ausloest (gemessen).
  //    Die Beruehrungsereignisse laufen weiter und entscheiden; gewischt wird
  //    ueber die Strecke aussortiert, nicht ueber den Abbruch.
  document.addEventListener("touchstart", (ev) => {
    const el = markedIn(ev);
    const t = ev.touches && ev.touches[0];
    if (el && t) tipAn(el, t.clientX, t.clientY);
  }, true);
  document.addEventListener("touchmove", (ev) => {
    const t = ev.touches && ev.touches[0];
    if (t) tipZieht(t.clientX, t.clientY);
  }, true);
  document.addEventListener("touchend", tipAus, true);
  document.addEventListener("touchcancel", () => { tip.s = null; }, true);

  // Der Klick bleibt als zweiter Weg stehen (Maus, Tastatur-Enter, aeltere
  // Browser ohne Zeigerereignisse). `openFrom` verhindert das Doppelte.
  const handleDetail = (ev, mitFokus) => {
    const hit = markedIn(ev);
    if (!hit) return;
    ev.stopPropagation();
    ev.preventDefault();
    actOn(hit, mitFokus);
  };
  document.addEventListener("click", (ev) => handleDetail(ev, false), true);
  // Die Zeilen tragen role="button", also muessen Enter und Leertaste wirken -
  // sonst verspricht die Beschriftung etwas, das die Tastatur nicht einloest.
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
    if (!markedIn(ev)) return;
    handleDetail(ev, true);
  }, true);

  // Oeffentlicher Eingang fuer das `onclick`-Attribut an der Zeile. Das
  // Attribut bleibt: es ist fuer WebKit das Signal "dieses Element ist
  // anklickbar" und sorgt fuer die Tipp-Rueckmeldung.
  window.auroraDetail = (elOrData) => {
    try {
      if (elOrData && elOrData.dataset &&
          (elOrData.dataset.auroraDetail || elOrData.dataset.auroraNav)) {
        actOn(elOrData, false);
        return;
      }
      if (elOrData && typeof elOrData === "object" &&
          !document.getElementById(SHEET_ID)) openSheet(elOrData, false);
    } catch (e) {
      console.warn("[aurora] Detailblatt liess sich nicht oeffnen:", e);
    }
  };

  // Eigener Name fuer den Sprung - im Kartentext liest sich `auroraNav`
  // richtiger als `auroraDetail`, es ist aber derselbe Eingang.
  window.auroraNav = (el) => window.auroraDetail(el);


  sweep();
  aufbauBeobachten();
  setInterval(sweep, 4000);
  window.addEventListener("location-changed", () => {
    setTimeout(sweep, 300);
    aufbauBeobachten();
  });
  console.info("%c AURORA-EFFECTS %c v2.26.0 ready (" + (WEBKIT ? "WebKit-Modus" : "Blink") + ") ", "background:#cba6f7;color:#11111b;font-weight:700", "background:#313244;color:#cdd6f4");
})();
