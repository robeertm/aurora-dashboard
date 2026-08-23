# Changelog

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
