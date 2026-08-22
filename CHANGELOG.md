# Changelog

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
