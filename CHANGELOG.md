# Changelog

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
