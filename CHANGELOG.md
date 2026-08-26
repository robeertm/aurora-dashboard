# Changelog

## 0.24.0

- **On a phone, a tile keeps a readable width.** Measured on a 430 px screen,
  the desktop minimum let three tiles share a row at 133 px each: the name was
  cut to an ellipsis after twelve characters and the value above it was clipped
  off the top of the frame. On screens up to 700 px wide a tile now asks for
  176 px, which makes it two tiles per row with the whole name in place. The
  screen scrolls anyway. Desktop layouts are untouched.
- **A tile whose text needs more room grows instead of clipping it.** The tile
  templates set a fixed frame height; that height is now treated as a minimum,
  so a long name pushes the frame taller rather than sliding out of the top of
  it. `height: 100%` keeps every tile in the same row the same height, so the
  frames still line up (the same rule as 0.21.4).
- Measured across every view of both installations at 430 px: tiles with
  clipped content went from dozens to **0**, grids too narrow to read to **0**,
  and rows of unequal height stayed at **0**.

---

## 0.23.0

- **A part-filled last row is stretched to fill — but only where every card in
  it keeps the same width.** Nine charts in two columns left the ninth alone at
  half width with bare space beside it; it now spans the row. The rule is
  arithmetic: stretch only when the column count divides by how many cards are
  left over (two columns with one left over becomes full width, four with two
  becomes half each). Three columns with two left over would need one and a half
  tracks per card, so those keep the grid width rather than making one card
  wider than its neighbour.
- Cards where Home Assistant sets the column span itself (full-width cards) are
  recognised and left alone.
- Measured at 1600 px across both installations: rows with unused width went
  41 -> 26 -> **11** and 64 -> 38 -> **10**. Eighteen of twenty-two views and
  twenty-one of twenty-six are now completely free of unused width; what remains
  is exactly the arithmetic that cannot come out even.

---

## 0.22.0

- **A grid never uses more columns than it has cards.** A room tab whose control
  section held two cards laid them out in a three-column grid: two cards of
  421 px and 430 px of empty row. A grid holding a single card gave it half the
  width and left the other half bare. The responsive column logic now caps the
  column count at the number of cards, so the row is filled and the cards stay
  exactly as wide as each other.
- Measured across both installations at 1600 px: rows with unused width dropped
  from 41 to 26 and from 64 to 38. Every case of "fewer cards than columns" is
  gone; what remains are trailing part-rows of larger grids, where the cards
  keep the grid's column width so a chart is never wider than the one above it.
- Widths *within* a row were already equal everywhere — the only exceptions are
  inside the weather card's own forecast layout, which is not ours to change.

---

## 0.21.4

- **Neighbouring cards now share one frame height.** Two charts side by side
  could end at visibly different heights — one frame 332 px, the one next to it
  408 px. The cause was not the per-card chart heights: Home Assistant already
  stretches every grid cell to the row height, but the glass card inside stopped
  at its own content height and left the rest of the cell empty. Two CSS lines
  adopted into the tile's shadow root make the card fill its cell, so the row
  decides the frame height — in every grid, at every window width and column
  count, and for cards added later.
- Measured across both installations, 48 views, at 1280 / 1600 / 2560 px:
  crooked rows went from twelve to zero. The sensor explorer (202 and 231 tiles)
  is level too.
- A card with much less content than its neighbour now shows empty glass below
  its content rather than a short frame. That is the trade-off of a shared row
  height; where the difference was large it comes from a chart whose sensor has
  no data at all.
- No colour changed — only height and box-sizing.

---

## 0.21.3

- **The moon is visible again.** The sky draws the real moon — its position from
  the observer's latitude and longitude, its phase as a proper lune — but two
  rules had made it disappear in practice. It was suppressed entirely above 85 %
  cloud cover, and on an overcast night that is most nights; and at 92 px behind
  a frosted card it read as a faint smudge rather than a moon. Cloud cover now
  *dims* the moon instead of deleting it (never below 0.8 opacity), and the disc
  is 132 px, large enough to carry its shape through the glass. Verified on a
  night with 88 % and 95 % cover: previously nothing rendered, now the disc is
  present with the correct label ("waxing gibbous, 94 % lit").
- No colour changed — only opacity, size, and the visibility rule.

---

## 0.21.2

- **The halo around a lit icon fades in instead of popping.** It had been
  starting at 85 % opacity, so the ring appeared fully formed from one frame to
  the next. Measured from a phone screen recording of a room view: the icon's
  brightness jumped by 11 of 255 in a single frame, three times in 5.6 seconds,
  exactly 2.4 s apart — the halo's own period. Everything else in the animation
  moved by less than 1.5 per frame, so that one pop was the entire "jerky"
  impression. The ring now grows out of nothing over the first fifth of the
  cycle, travels, fades, and rests before the next beat. Frame-accurate figures
  after the change: the steepest step is 0.046 of opacity per frame instead of
  0.85, and the icon underneath was already smooth (0.008 opacity and 0.001
  scale per frame).
- **Per-keyframe easing.** The card asks for `ease-out`, which is fastest at the
  start — exactly where a ring must be gentlest. The fade-in carries its own
  `ease-in-out` inside the keyframes, so the card's declaration stays untouched
  and nothing snaps at either end of the rise.


## 0.21.1

- **A flat series is drawn flat.** Where zero is the natural floor of a
  measurement — power, energy, illuminance, current, water, gas, cost, runtime —
  the chart is pinned to it. Without that, mini-graph scales to the range it
  finds, so a sensor sitting at 0.00 all day had its last digit of noise
  stretched over the full height and painted a bright hill where there was no
  traffic at all. Battery and humidity are pinned to 0–100 for the same reason.
- **No separate view for per-device network rates.** They are back in the list
  view with the other things a curve cannot describe: on a real installation
  most of those sensors read zero most of the time, which is exactly the case
  the paragraph above is about, and a view of two hundred empty charts earns
  nobody anything.


## 0.21.0

- **Every trend now says what it shows.** A chart with a title, two lines and a
  Min/Max block is not self-explanatory — the washing machine view was the proof:
  its "remaining time" plot drew the countdown and the elapsed time on top of
  each other, filled both, and crossed them into an X that means nothing. Each
  plot header carries a plain-language line under its title now, naming what the
  curve is and in which unit ("How far the radiator valve was open — 100 % is
  full heat, 0 % is shut"). The wording is checked against the entity's real
  unit, which is how twenty-three captions that named the wrong one were caught.
- **The Min/Max block is gone.** It cost three lines above every chart and often
  said nothing at all — a socket that was off all day reported "Min 0 W 18:40 /
  Max 0 W 18:40". The header already carries the current value and the axis the
  range.
- **Step-shaped quantities are no longer smoothed.** Valve positions, battery
  levels, fill levels and countdowns move in steps; drawing them as a soft curve
  invents values that were never measured.
- **Long windows are outlier-proof.** Thirty-day plots take one point every two
  hours and aggregate by median, so a single dropped radio reading no longer
  drags a battery curve to the floor.
- **A sensor that reports nothing reads as zero, not as its last value.** An
  appliance that goes `unknown` when idle used to leave its last number standing
  flat across the whole day.
- **The scan dot is back, and it rides on the curve.** A small bright dot travels
  along every trend, the way the old apexcharts series looked. Getting there was
  a lesson in what costs frames: a copy of the path with a travelling dash
  measured 60 → 6 fps on a room view (shifting a dash repaints the entire
  curve); moving a real circle with `<animateMotion>` inside the chart's own svg
  still cost 60 → 39 (the motion invalidates that whole gradient-filled
  drawing); the same circle on its own transparent layer above the chart costs
  nothing measurable — 60.4 fps with the dot and 60.4 without. A drop-shadow
  glow around it costs another 7 fps, so it wears a thin bright rim instead.
- **A sensor explorer made of small charts.** Every measurement in the house as
  its own tile — name, current value, a six-hour sparkline — two per row on a
  phone and six across on a desktop. `auto-entities` cannot build this
  (`mini-graph-card` needs an `entities` list, and auto-entities injects a
  single `entity`), so `tools/build_explorer.py` generates the views from the
  live states.
- **Measured limits, written down rather than guessed.** Roughly 250 tiles per
  view is the ceiling: 512 tiles measured 14 fps, 231 measured 34, 163 measured
  43. One glass card per class instead of one per tile is worth 18.5 → 44 fps.
  Per-device network rates alone halve whatever view they sit in, so they get a
  view of their own.
- **New template `aurora_plot_tile`** — the plot header squeezed for two-across
  tiles: the name takes the full width over two lines, the time window and the
  value share the row below. Same colours, no new tone.
- **The time axis picks its tick count from the card width**, so narrow tiles
  show "−6 h … now" instead of five labels wrapping into two lines of noise.


## 0.20.1

- **The sky moves on phones too.** It had been frozen outright below 700px —
  which is what made it look, on a handset, as though the animation simply died
  once the page finished updating: the card animates on first paint, then the
  shared stylesheet is adopted into its shadow root and `animation: none` wins.
  Measured in a phone-sized WebKit window: 60 fps frozen versus 58.6 fps with
  the whole scene running on the overview and 59.7 on the heaviest room view.
  Phone cards carry no `backdrop-filter` either, so nothing behind them is
  re-blurred per frame. What stays off there are the particle swarms — rain,
  snow, falling leaves, fireflies — because those are not one element each but
  dozens in bad weather, and they scale with the forecast rather than with the
  layout.

## 0.20.0

- **The sky moves again in Safari.** The whole scene — sun, drifting clouds,
  birds, swaying grass — had been frozen on WebKit since the performance pass,
  on the assumption that a full-screen animated layer was not worth a repaint
  per frame there. That was too blunt. Every animation in the scene moves
  `transform` or `opacity` only, and on WebKit the cards carry no
  `backdrop-filter` at all, so nothing behind them has to be re-blurred — the
  very thing that made an animated backdrop expensive does not apply. Measured
  with the scene running: 59 fps on the overview before and after, and no loss
  on the heaviest room view either. The compositor promotion that makes this
  true stays in place.
- **Lit icons breathe smoothly instead of stuttering.** A lamp that is on ran
  `aurora-breathe` and `aurora-flicker` at the same time — and both animated
  `opacity`, so the later one in the list won the property outright. The
  flicker's stepped candle keyframes were all you ever saw: measured, opacity
  sat at 1.00 for 2.6 s and then jumped to 0.66 in a single frame. The flicker
  now moves `scale` instead, so the two compose rather than fight, both stay on
  the compositor, and the largest change per frame drops from a visible step to
  0.008.
- **The halo ring on lamps and sockets is actually visible.** It was running
  correctly all along, just too faint to notice next to a lit border and a glow.
  A stronger variant (`aurora-halo-strong`) and a ring width variable
  (`--aurora-halo-width`, default 2px) give those tiles a ring that reads. Every
  other template keeps the original `aurora-halo` untouched.

## 0.19.0

- **The moon is real now.** It rises where the moon actually is (position
  computed from the installation's own latitude/longitude, no service, no extra
  integration), travels across the sky as the night goes on, and is drawn with
  its **true phase** — the lit part is a computed lune, so a waxing crescent
  looks like a waxing crescent. Hovering it names the phase and the illuminated
  percentage. It also appears at dusk when it is already up, and stays hidden
  below the horizon or behind thick cloud
- **The trend charts got their axes back.** Every chart now has a grid, a time
  axis underneath (`−24 h … now`, in days for longer spans), value labels on the
  left, and min/max with unit *and* the time they occurred. The helper draws the
  grid and the time axis itself — `mini-graph-card` has neither
- **Charts drawn finely, not chunkily**: 30 points per hour instead of 4, a
  1.4 px line with a soft static glow, so they read like the old chart tiles
  again
- **Charts standing next to each other are exactly the same height.** A legend
  costs vertical space, so charts that have one get a correspondingly shorter
  plot area — the cards line up either way
- Series that sit at a constant value (a full battery, a closed valve) are drawn
  on a fixed 0–100 scale without an area fill, instead of as one solid block
- **Any chart series with more than ~2000 points per day is drawn by
  mini-graph-card**, not apexcharts: fetching and laying out tens of thousands
  of raw points is what made the Overview take 150 s in Safari (**now 1.8 s**).
  Remaining apexcharts series are grouped into 2–10 minute averages

## 0.18.0

The 0.17.0 pass was measured in Chrome, and Chrome was never the problem: on
**Safari — and therefore on every browser on an iPhone, because Apple requires
WebKit there** — a room view took up to **160 seconds** to finish and scrolled
at **4 fps**. Measured in real WebKit this time.

- **Per-room trend charts now use `mini-graph-card` instead of
  `apexcharts-card`.** In WebKit a room view of 92 cards with four apexcharts
  took 160 s; without the charts, 2.3 s; with mini-graph, **4.7 s and 53 fps**.
  The charts are not slow by themselves — the same four in a view of their own
  render in 1 s. ApexCharts forces layout measurements while drawing and WebKit
  re-lays-out the whole page for each one, so the cost is charts × page
  complexity. The analysis views (Overview, Energy, Network, Radio) keep
  apexcharts: there the charts *are* the content and the views are small.
  Bar charts stay on apexcharts too — mini-graph has no equivalent
- **Safari and iOS now get the phone treatment at any window size**: no
  per-card backdrop blur (WebKit re-resolves every blurred card against the
  full-screen backdrop while scrolling), a still sky, and the sky promoted to
  its own layer
- **Idle decoration no longer animates anywhere** — floating, swinging,
  shimmering icons. Measured in Chrome, they were half of the CPU spent while
  scrolling a room view (17 % → 7 %). Animations that carry meaning all stay: a
  light that is on breathes and wears its halo, a low battery blinks, an open
  window pulses, an open valve spins, an active automation wobbles
- **`will-change` only on elements that actually animate.** Setting it on every
  icon promoted 76 elements per room view to their own GPU layer and was the
  only source of dropped frames while scrolling

## 0.17.0

Performance release — room views were slow to open and could take the Home
Assistant companion app down on a phone. Everything below was measured on a
real installation (1450 entities) with Chrome in phone emulation (390×844 at
3× device pixels, CPU throttled 4×), against the same installation's
stock dashboard as the reference.

- **One shared stylesheet instead of a copy per card.** The effects helper used
  to append its `<style>` block to every card's shadow root. A room view holds
  ~100 cards, so the browser had to parse and re-match **428 kB of duplicated
  CSS in 175 stylesheets**. It is now a single constructable `CSSStyleSheet`
  adopted by every root: **89 kB in 13 stylesheets**. Opening a room view went
  from 1.8–3.6 s to 0.8–2.2 s, and one view that never settled at all (43 s)
  now opens in 0.8 s
- **`aurora_base` no longer ships `extra_styles`.** button-card copies a
  template's `extra_styles` into every card that inherits it — ~90 copies per
  room of a keyframe block the helper already provides, including an outdated
  `box-shadow` halo that 0.13.0 had replaced for being a paint animation
- **Counter chips no longer scan every entity.** Each chip ran
  `Object.values(hass.states)` — through button-card's proxy, that is one
  property read per entity, three times per chip (text, colour, animation), on
  every render. They now pre-filter by domain on the key first. On the Overview
  this alone took idle CPU from **~46 % to ~20 %**
- **`aurora-breathe` no longer animates `drop-shadow()`.** The glow is now
  static and only its opacity breathes — same look, on the compositor. In a
  room with several lights on this was worth ~40 % of that view's CPU
- **Phone mode.** Under 700 px the cards drop their backdrop blur (each blurred
  card is its own compositing layer plus a snapshot of everything behind it, at
  3× device pixels) and become slightly more opaque instead; the sky keeps its
  picture but stops moving; idle decoration (floating, swinging, shimmering
  icons) stops. Animations that *mean* something — a blinking low battery, a
  pulsing open window, the halo on a light that is on — keep running
- **The clock/weather card gets a still icon on phones.** Its animated icons are
  SVG images that animate inside their own image document, so neither CSS nor
  JavaScript can pause them — they repainted continuously and measured ~20 % CPU
  on their own. The card is now declared twice behind `conditional` cards with a
  `screen` condition, animated above 700 px, still below
- Measured result: a room view is now **4.9 % idle CPU against the stock
  dashboard's 5.5 %**, and the Overview 19.6 % against 7.6 %

## 0.16.0

- **Per-room trend charts**: every room view now ends with a *Trends* section —
  actual vs. target temperature and the valve position over 24 h, in the same
  mission-control style as the rest
- **The WAN chart header now shows total throughput** (down + up) instead of
  just the download figure the header entity happened to carry
- **Plot headers no longer print `NaN`** when a sensor is unknown (a washing
  machine that is not running, a counter that has not started) — they show `—`
- **The Phone view is gone.** With one view per room, Home Assistant already
  lays every tab out well on a phone; a separate mobile tab was one more place
  to keep in sync for no gain

## 0.15.0

- **The sky now reflects the weather at your location.** The palette follows
  the condition, the number of clouds follows `cloud_coverage`, their speed
  follows the real `wind_speed`, and rain, snow, fog and lightning are drawn on
  top while the sun fades out behind thick cover
- **A seasonal meadow instead of a dark hill silhouette.** Fresh green with
  spring flowers, deep green with poppies in summer, golden with falling leaves
  in autumn, snow-covered in winter — plus a hand-drawn tree line on the
  horizon, grass swaying along the bottom edge, birds on calm days and
  fireflies on summer nights. Set the sky template's `season` variable to pin
  one instead of following the month
- **The sky switch is now a visible row of four labelled buttons** (Auto / Day
  / Dusk / Night) under the status card, with the active one lit. The previous
  cycle-through tile was simply not recognised as a switch
- New **weather tile** showing the current condition
- Section headings get a soft text shadow from the effects helper, so they stay
  readable over a bright sky or a snow-covered meadow
- Measured: every weather condition lands in the same 15–25 % idle-CPU band as
  before — heavy rain is the *lowest* reading, so the spread is noise

## 0.14.1

- Night sky polish: the moon is larger, sits just below the header where a gap
  usually remains, and has a tighter glow plus an inset shadow — behind a glass
  card the backdrop blur otherwise smeared it into a featureless bright spot.
  Day clouds are a touch more present

## 0.14.0

- **A sky that follows the sun.** Three hand-drawn full-screen scenes — Day
  (blue sky, drifting clouds, rotating sun rays), Dusk (violet to amber with
  the first stars) and Night (drifting constellations plus a moon). It switches
  automatically with the real sun elevation or by hand via the new
  `input_select.sky_mode` helper and the *Sky* tile. In Day and Dusk the sun is
  placed by the real azimuth and elevation. Everything is CSS gradients and
  hand-placed SVG points — no third-party artwork and no image files
- **House traffic light** (`aurora_status`): one card at the top of the
  Overview that surfaces what needs attention — window open while that room is
  heating, low batteries, device faults, laundry finished, lights on with
  nobody home, unusual power draw, pending updates, holiday mode. When nothing
  is pending it reads *All clear* and the ring stops pulsing. All checks run
  client-side; devices to ignore and the fault sensors to watch are explicit
  variables, so "since boot" flags cannot make the card red forever
- **Phone view**: one compact tab (status, quick switches, room temperatures,
  what is on, what is open) for use away from the desk
- Room tiles no longer truncate their name on a phone
- Fixed the open-windows list in the new views: `auto-entities` has no
  top-level `device_class` rule — the device class belongs under `attributes:`

## 0.13.0

Performance release — measured, not guessed (Chrome `Performance.getMetrics`,
15 s idle, 1450-entity installation).

- **One view per room** instead of a single view holding all of them:
  **~73 % → 9–29 % CPU while idle**. The Smart Home tab is now a light overview
  (key figures + one tile per room) that links into each room's own view
- `triggers_update: all` removed from the room and automation templates and
  replaced with explicit entity lists on the counter chips — this alone took
  the dashboard from 120 style recalculations per second down to HA's own
  baseline
- Animations reworked to stay on the compositor: the halo ring is now a scaled
  pseudo element instead of an animated `box-shadow`, scene shimmer uses
  `opacity`/`transform` instead of `filter`, and animated icons get their own
  layer. Animating paint properties inside a `backdrop-filter` card forces the
  blur to be recomputed every frame — one permanently pulsing badge cost 9 % CPU
- The window badge only pulses when a window is actually open
- Cards scrolled out of view have their animations paused (IntersectionObserver)
- Grid columns are now driven by a `ResizeObserver` instead of a one-off
  measurement, so a grid that gets its real width late is corrected

## 0.12.0

- **Smart Home view rebuilt**: one section per room with three columns —
  climate (thermostat, setpoint slider, valve, batteries, window), light +
  scenes, switches + media + automations. Lights, scenes, switches and
  automations are discovered **by area**; room group entities are excluded so
  a room is not counted twice
- New **Automations** view: every automation as a toggle tile, plus scripts,
  toggle helpers and number helpers
- New templates: `aurora_automation` (wobbling robot), `aurora_valve` (icon
  spins faster the wider the valve is open), `aurora_action` (script runner),
  `aurora_group_header`
- **Every icon animates** — shared keyframe library shipped by
  `aurora-effects.js` (v1.5.0) into every card shadow root, so child templates
  can use the animations even though their `extra_styles` replaces the parent's
- `aurora_metric` now rounds raw values (4.57999992370605 kWh → 4.58 kWh) and
  lets Home Assistant translate enum states
- **Responsive rewrite**: grid columns are now derived from the measured width
  instead of viewport breakpoints, so a grid inside a narrow inner column gets
  the same treatment as one on a phone

## 0.11.0

- New **Radio** view: BLE scanner cards with a rotating radar sweep
  (`aurora_radar` template), every `signal_strength` sensor auto-discovered as
  a traffic-light dBm tile that pulses when weak (`aurora_signal` template),
  plus RSSI history charts
- **Glass 2.0** (`aurora-effects.js` v1.3.0): stronger backdrop blur with
  saturation boost, a diagonal light sheen and top-edge highlight on top-level
  cards; cards nested inside `stack-in-card` stay blur-only so a tile reads as
  one pane of glass

## 0.10.0

- New **Smart Home** view: one glass card per room with a monospace room
  header (live temperature, pulsing *window open* badge via the new
  `aurora_room` button-card template), the native Home Assistant thermostat
  dial as the heating control, animated light/switch tile grids, and optional
  media player rows
- Summary chips on top: average room temperature, heating active, windows
  open, lights on (all computed client-side)
- Rooms are laid out as three masonry-style columns that collapse to a single
  column on phones (handled by `aurora-effects.js`)

## 0.9.2

- One-click install: HACS support for the effects helper (`hacs.json`,
  helper moved to `dist/`) and an `install.sh` that sets up theme, helper,
  and dashboard YAML in one command
- License changed from MIT to a source-available "use only" license

## 0.9.1

- Responsive layout on phones/tablets: `aurora-effects.js` now reduces fixed
  grid columns on narrow screens (chart/clock groups collapse to one column,
  button grids to 3/2 columns at 900/600 px)
- Fluid plot-header typography (`clamp()`), no more truncated labels on mobile

## 0.9.0

Initial version.

- Aurora theme (Catppuccin Mocha, glass cards, static aurora gradient background)
- 7 views: Overview, Lights, Climate, Energy, Network, System, Sensor Explorer
- `aurora-effects.js`: dependency-free helper for glass blur, the scan glow-spot
  on charts, and legend cleanup — no card-mod required
- Animated constellation background (inline SVG, drift + twinkle,
  `prefers-reduced-motion` aware)
- Mission-control chart tiles: monospace header, glowing live value, neon
  step-lines with native ApexCharts drop-shadow glow and a travelling scan pulse
- Animated button-card templates: breathing lights with pulsing halo, switches,
  scenes, persons, windows, batteries, metric tiles, counter chips
- Auto-discovery throughout (auto-entities): lights, switches, scenes, climate,
  windows, batteries, RSSI, trackers, updates, and an Explorer covering every
  sensor by device class
- Zero backend Jinja card templates by design (performance-safe)
