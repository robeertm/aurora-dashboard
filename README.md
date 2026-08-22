# ✨ Aurora Dashboard

**A dark, animated mission-control dashboard for Home Assistant.**
Glass cards over an animated constellation sky, neon-glow charts with a travelling
scan pulse, animated buttons — and an *Explorer* view that surfaces **every single
sensor** in your installation, grouped by device class, with zero configuration.

> Catppuccin-Mocha palette · 7 views · auto-discovering · no expensive backend templates

![Overview](docs/screenshots/home.png)

## Highlights

- 🌌 **Animated constellation background** — fine star-lines drifting and twinkling
  behind everything (pure CSS + inline SVG, respects `prefers-reduced-motion`).
- 📈 **Mission-control plots** — monospace label, big glowing live value, neon
  step-line with gradient fill, and an animated **scan pulse** running along the curve.
- 🔘 **Animated buttons** — lights breathe amber when on, switches glow green,
  open windows pulse orange, low batteries pulse red.
- 🔭 **Sensor Explorer** — *every* sensor and binary sensor in your install,
  grouped by device class, sorted, auto-discovered. Nothing falls through.
- ⚡ **Live counter chips** — lights on, windows open, updates pending, people
  home, low batteries … computed client-side in the browser.
- 🛡 **Performance-safe by design** — there is deliberately **not a single Jinja
  card template** in this dashboard. All logic runs client-side (button-card JS,
  auto-entities patterns). Card templates with registry scans are re-rendered by
  Home Assistant on *every* state change and can bring a busy instance down;
  Aurora never does that.

## Requirements

Home Assistant 2024.11+ (sections views with `grid_options`). Install these
frontend cards (via HACS or manually):

| Card | Used for |
|------|----------|
| [button-card](https://github.com/custom-cards/button-card) | all animated tiles, chips, plot headers |
| [apexcharts-card](https://github.com/RomRider/apexcharts-card) | all charts |
| [auto-entities](https://github.com/thomasloven/lovelace-auto-entities) | auto-discovery (lights, batteries, explorer …) |
| [stack-in-card](https://github.com/custom-cards/stack-in-card) | seamless plot tiles |
| [mushroom](https://github.com/piitaya/lovelace-mushroom) | climate + media cards |
| [clock-weather-card](https://github.com/pkissling/clock-weather-card) | hero clock/weather |

**No card-mod required.** The glass blur and the scan-pulse animation come from
the bundled `www/aurora-effects.js` (a ~90-line dependency-free helper).

## Install

1. **Theme** — copy `themes/aurora.yaml` into your `config/themes/` folder
   (with `frontend: themes: !include_dir_merge_named themes`), then call the
   `frontend.reload_themes` action.
2. **Effects helper** — copy `www/aurora-effects.js` to
   `config/www/aurora-effects/aurora-effects.js` and register it as a dashboard
   resource: `/local/aurora-effects/aurora-effects.js` (type *module*).
3. **Dashboard** — create a new dashboard and paste `dashboard/aurora.yaml`
   into its raw configuration editor. Set the *Aurora* theme on each view (the
   shipped YAML already does).
4. **Adapt the entities** — most of the dashboard auto-discovers, only the hero
   metrics and charts reference concrete entities. Search the YAML for these and
   replace them with yours:

   | Placeholder in YAML | Meaning |
   |---------------------|---------|
   | `weather.forecast_home` | your weather entity |
   | `sensor.total_power` | current house power (W) |
   | `sensor.total_energy_today` | energy today (kWh) |
   | `sensor.total_cost_today` | cost today |
   | `sensor.outdoor_temperature` | outdoor temperature |
   | `sensor.wan_download_rate` / `sensor.wan_upload_rate` | live WAN throughput |
   | `sensor.wan_download_today` … | WAN volume counters (MB) |
   | `sensor.room_temp_*` | one temperature sensor per room |

   Everything else (lights, switches, scenes, climate, windows, batteries, RSSI,
   trackers, updates, the whole Explorer) finds your entities by itself.

## The scan pulse

Charts get the travelling pulse by adding the same entity a second time as a
line series named exactly `scan`:

```yaml
series:
  - entity: sensor.total_power
    name: Power
    color: "#fab387"
  - entity: sensor.total_power
    name: scan          # <- aurora-effects.js animates any series named "scan"
    type: line
    color: "#fab387"
    stroke_width: 3
    show: { in_header: false, legend_value: false }
```

The glow comes from ApexCharts' native `chart.dropShadow` — see any chart in the
shipped YAML for the pattern.

## Performance notes

- Counter chips and button animations run entirely in the browser.
- `auto-entities` filters use include/exclude patterns only — **never** its
  `template:` filter (that would subscribe a backend template).
- If you add your own cards: put expensive Jinja (`integration_entities`,
  `device_entities`, `states.x` scans) into a *template sensor* with a time
  trigger, never onto a card. Cards re-render on every state change.

## License

MIT © Robert Manuwald
