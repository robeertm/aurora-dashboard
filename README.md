# ✨ Aurora Dashboard

**A dark, animated mission-control dashboard for Home Assistant.**
Glass cards over an animated constellation sky, neon-glow charts with a travelling
scan pulse, animated buttons — and an *Explorer* view that surfaces **every single
sensor** in your installation, grouped by device class, with zero configuration.

> Catppuccin-Mocha palette · one view per room · auto-discovering · no expensive backend templates

![Overview](docs/screenshots/home.png)

![A status row, opened](docs/screenshots/detail-sheet.png)

*Every row of the status card explains itself — what was found, why it matters, and what you can do about it.*

![Climate view](docs/screenshots/climate.png)

*Room temperatures over 24 hours, thermostats underneath.*

![Energy view](docs/screenshots/energy.png)

*Power over the day, kWh per day, and where they went.*

![System view](docs/screenshots/system.png)

*Batteries, host metrics and what is waiting to be updated.*

![Lights view with 24-hour colour strips](docs/screenshots/lights.png)

*Every lamp, and a 24-hour colour strip for each one (the strips come from a small generator outside this repository).*

![Radio view](docs/screenshots/radio.png)

*Bluetooth scanners, signal strength and its history.*

<p align="center">
<img src="docs/screenshots/phone.png" width="270" alt="On a phone">
&nbsp;&nbsp;
<img src="docs/screenshots/phone-detail.png" width="270" alt="A row opened on a phone">
</p>

<p align="center"><em>All screenshots come from a throwaway instance with
placeholder data — every name, room and value in them is made up. The
instance can be rebuilt with <code>tools/demo/demo.sh</code>.</em></p>

> ### ⚠️ Please read before installing
>
> **This project is written with AI assistance.** The dashboard configuration,
> the card templates and this README are largely AI-generated and reviewed by a
> human, not the other way round. Treat it as a hobby project, not as audited
> software.
>
> **It is provided "as is", with no warranty and no liability of any kind** —
> for errors, for a broken dashboard, for wrong readings, or for anything that
> follows from using it. **You use it at your own risk.**
>
> Two things deserve saying plainly:
>
> - **The cards act on your real home.** Buttons here call Home Assistant
>   services: they switch lights, sockets and other devices. An entity id that
>   does not match your setup will operate something you did not intend — check
>   every id against your own system before trusting a card.
> - **Back up your Lovelace configuration first.** Applying this replaces
>   dashboard views. Keep a copy of what you had so you can go back.
>
> Not affiliated with, endorsed by, or supported by Home Assistant or Nabu Casa.


## Highlights

- 🌅 **A sky that follows the sun, the weather and the season** — three
  hand-drawn full-screen scenes (**Day**, **Dusk**, **Night**) that switch with
  the real sun elevation or from a visible four-button row.
  - The sun sits **where it actually stands**: azimuth drives its horizontal
    position, elevation its height.
  - The sky **reflects the weather at your location**: the palette follows the
    condition, the **number of clouds follows the cloud cover**, their **speed
    follows the real wind**, and rain, snow, fog and lightning are drawn on top
    while the sun fades out behind thick cover.
  - At night the **moon is where the moon actually is** — its position is
    computed from your installation's own latitude and longitude, it travels
    across the sky as the night goes on, and it is drawn with its **true
    phase**: the lit part is a computed lune, so a waxing crescent looks like
    one. Hover it for the phase name and the illuminated percentage.
  - The ground is a **meadow that follows the season** — fresh green with
    spring flowers, deep green with poppies in summer, golden with falling
    leaves in autumn, snow-covered in winter. Plus a tree line on the horizon,
    swaying grass, birds on calm days and fireflies on summer nights.
  - Everything is CSS gradients and SVG shapes drawn for this project;
    **no third-party artwork, no image files, nothing to license**.
- 🚦 **House traffic light** — one card at the top that shows what needs
  attention instead of what is always the same: a window open while that room
  is heating, low batteries, a device fault, laundry finished, lights on with
  nobody home, unusual power draw, pending updates. When nothing is pending it
  says *All clear* and stops pulsing.
- 📈 **Per-room trends** — every room view ends with actual-vs-target
  temperature and valve position over 24 h, drawn with a grid, a time axis
  (`−24 h … now`), value labels, and min/max with unit and time. Charts placed
  next to each other are the same height whether or not they carry a legend.
- 🌌 **Animated constellation background** — fine star-lines drifting and twinkling
  behind everything (pure CSS + inline SVG, respects `prefers-reduced-motion`).
- 📈 **Mission-control plots** — monospace label, big glowing live value, neon
  step-line with gradient fill, and an animated **scan pulse** running along the curve.
- 🔘 **Animated buttons** — lights breathe amber when on, switches glow green,
  open windows pulse orange, low batteries pulse red.
- 🏠 **One view per room** — each room gets its own tab with three columns:
  climate (thermostat dial, setpoint slider, valve position, battery tiles,
  window state), light + scenes, and switches + media + automations. Lights,
  scenes, switches and automations are discovered **by area**, so assigning
  entities to areas in Home Assistant is all the setup there is. A light
  overview tab shows the key figures and links into each room.
- 🤖 **Automations everywhere** — every automation appears as a toggle tile
  (green robot wobbling when active, grey when off), both inside its room and
  on a dedicated Automations view together with scripts and helpers.
- ✨ **Every icon animates** — lights breathe and flicker, scenes shimmer with
  staggered delays, valves spin faster the wider they open, robots wobble,
  batteries blink when low, radar sweeps rotate. All from one shared keyframe
  library, all silenced by `prefers-reduced-motion`.
- 📡 **Radio view** — BLE scanner cards with a **rotating radar sweep**, every
  `signal_strength` sensor auto-discovered as a traffic-light dBm tile
  (pulses red when weak), and RSSI history charts.
- 🧊 **Real glass** — cards get a strong backdrop blur plus a diagonal light
  sheen and top-edge highlight, injected by the effects helper. (Firefox, Safari
  and phones get the same glass with a more opaque card colour instead of the
  blur — see *Performance*.)
- 🔭 **Sensor Explorer** — *every* sensor and binary sensor in your install,
  grouped by device class, sorted, auto-discovered. Nothing falls through.
- ⚡ **Live counter chips** — lights on, windows open, updates pending, people
  home, low batteries … computed client-side in the browser.
- 🛡 **Performance-safe by design** — there is deliberately **not a single Jinja
  card template** in this dashboard. All logic runs client-side (button-card JS,
  auto-entities patterns). Card templates with registry scans are re-rendered by
  Home Assistant on *every* state change and can bring a busy instance down;
  Aurora never does that.

- **The status card explains itself.** Every row it reports can be tapped: a
  sheet says what was found, why it matters and what you can do about it, with
  a button that jumps to the matching view or opens the device.
- **Every overview tile opens something.** Jump to the matching view, or — for
  *At home* and *Media playing*, which have no view of their own — a sheet that
  lists who is home and what is playing. Tap, Tab + Enter or Space, one focus
  ring on all of them.
- **A way back in every view.** Each view heading carries a chip back to the
  overview, built from the dashboard's own path — so it works whatever you
  called it.

## Requirements

Home Assistant 2024.11+ (sections views with `grid_options`). Install these
frontend cards (via HACS or manually):

| Card | Used for |
|------|----------|
| [button-card](https://github.com/custom-cards/button-card) | all animated tiles, chips, plot headers |
| [apexcharts-card](https://github.com/RomRider/apexcharts-card) | the analysis charts (Energy, Network, Radio, Overview) |
| [mini-graph-card](https://github.com/kalkih/mini-graph-card) | the per-room trend charts — see the Safari note under *Performance* |
| [auto-entities](https://github.com/thomasloven/lovelace-auto-entities) | auto-discovery (lights, batteries, explorer …) |
| [stack-in-card](https://github.com/custom-cards/stack-in-card) | seamless plot tiles |
| [mushroom](https://github.com/piitaya/lovelace-mushroom) | climate + media cards |
| [clock-weather-card](https://github.com/pkissling/clock-weather-card) | hero clock/weather |

**No card-mod required.** The glass blur and the scan-pulse animation come from
the bundled `dist/aurora-effects.js` (a small dependency-free helper).

## Easy install (one click)

**Helper entities in one file:** `packages/aurora_helpers.yaml` defines every
helper the dashboard reads (sky switch, person pulse, room setpoint sliders).
See *Helper entities as a package* below; it replaces the per-helper steps.

**Effects helper via HACS:**

[![Open your Home Assistant instance and open this repository inside HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=robeertm&repository=aurora-dashboard&category=plugin)

This adds the repo to HACS and installs `aurora-effects.js` including the
dashboard resource — one click, then "Download". After that, create the `sky_mode`
helper (see *The sky switch* below); the sky buttons need it.

**Theme + dashboard in one command** — SSH into Home Assistant and run this
inside `/config`:

```sh
curl -fsSL https://raw.githubusercontent.com/robeertm/aurora-dashboard/main/install.sh | sh
```

It places the theme, the effects helper, and `aurora-dashboard.yaml` and prints
the two remaining UI steps.

## Manual install

1. **Theme** — copy `themes/aurora.yaml` into your `config/themes/` folder
   (with `frontend: themes: !include_dir_merge_named themes`), then call the
   `frontend.reload_themes` action.
2. **Effects helper** — copy `dist/aurora-effects.js` to
   `config/www/aurora-effects/aurora-effects.js` and register it as a dashboard
   resource: `/local/aurora-effects/aurora-effects.js?v=2.40.1` (type *module*).
   **When you update the file, change the number after `?v=`** (any new value
   works): the browser keeps a resource without a version, and Firefox did so
   even after a hard reload.
3. **Dashboard** — create a new dashboard and paste `dashboard/aurora.yaml`
   into its raw configuration editor. Set the *Aurora* theme on **every** view
   (the shipped YAML already does). A view that misses `theme: Aurora` falls
   back to the default light theme in any browser that has not picked Aurora by
   hand: its native cards turn white, and the glass never appears — the effects
   helper only styles a card while the theme variable `aurora-fx` is present.
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
   | `sensor.your_server_*` | your server / Raspberry Pi monitor sensors (System view) |
   | `sensor.wan_download_today` … | WAN volume counters (MB) |
   | `sensor.room_temp_*` | one temperature sensor per room |
   | `climate.trv_*` | one thermostat (TRV) per room — Smart Home view |
   | `binary_sensor.window_*` | window contact per room — Smart Home view |
   | `sensor.trv_*_valve` / `sensor.trv_*_battery` | valve position + battery per room (optional) |
   | `input_number.room_setpoint_*` | optional room-setpoint helper shown as a slider |
   | `media_player.*` | one media row per room (optional) |
   | `sensor.ble_scanner_*` | optional BLE scanner metrics (adverts / unique devices / avg RSSI) — Radio view; the signal-tile grid works without them |
   | `input_select.sky_mode` | the sky switch — see below |

### Helper entities as a package

Instead of creating the helpers one by one, use the ready-made package file
[`packages/aurora_helpers.yaml`](packages/aurora_helpers.yaml). It defines
`input_select.sky_mode`, `input_select.person_pulse` and one
`input_number.room_setpoint_*` slider per room, all with generic names.

1. Copy it to `config/packages/aurora_helpers.yaml`.
2. Make sure `configuration.yaml` loads packages (skip if it already does):

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```

3. Restart Home Assistant (helpers from YAML need a restart, a reload is not
   enough).

Only `sky_mode` is needed; delete the rest if you do not want it. Rename or
remove the room setpoints to match your rooms — the id suffix must match the one
used in `dashboard/aurora.yaml`. Do not define the same helper twice: if you
already created one in the UI, remove it from the package. `python
scripts/check_dashboard.py` checks that the file is valid and covers every
helper the dashboard uses.

### The sky switch

The sky reads one helper. Create it in *Settings → Devices & services →
Helpers → Dropdown*, name it `sky_mode`, and give it exactly these four
options — or drop this into your `configuration.yaml`:

```yaml
input_select:
  sky_mode:
    name: Sky
    icon: mdi:theme-light-dark
    options: [Auto, Day, Dusk, Night]
```

On **Auto** the scene follows `sun.sun`: above 6° elevation is Day, down to
−8° is Dusk, below that Night. A row of four labelled buttons sits under the
status card on the Overview and Phone views — the active one lights up.
Nothing else is wired to the helper: no automation, no template sensor. If
the helper is missing, the buttons have nothing to write to and do nothing.

The weather comes from the entity named in the sky template's `weather`
variable (`weather.forecast_home` by default) — it reads the condition,
`cloud_coverage` and `wind_speed`. The season is derived from the month; set
the template's `season` variable to `spring`, `summer`, `autumn` or `winter`
to pin one.

   The **Smart Home** view is a copy/paste pattern: duplicate one room section,
   swap the climate entities, set the area name and accent color — the light,
   scene, switch and automation columns fill themselves from that area.
   Room *group* entities (e.g. a Hue room `light.living_room`) are excluded on
   purpose: they would light up in parallel with every single lamp and make the
   room look twice as busy as it is.

   Everything else (lights, switches, scenes, climate, windows, batteries, RSSI,
   trackers, updates, the whole Explorer) finds your entities by itself.

### The person pulse

Each person card glows softly in time with a slow pulse; colour and strength
fade with how long the person has been home or away. How much of that you want
is one setting. Create a dropdown helper (*Settings → Devices & services →
Helpers → Dropdown*) named `person_pulse` with exactly these three options, in
this order — or drop this into your `configuration.yaml`:

```yaml
input_select:
  person_pulse:
    name: Person pulse
    icon: mdi:pulse
    options: [Always, On change, Off]
```

- **Always** — the pulse never stops (the behaviour of every earlier version,
  and what you get if the helper does not exist).
- **On change** — two beats (about 5 s) after someone arrives or leaves, then
  the card rests; the colour stays. It counts from the entity's `last_changed`,
  so it is right after a page reload too.
- **Off** — no pulse at all.

The helper is read by position, so you may rename the options (say, to your own
language) but keep the order. With the system setting *reduce motion* the card
never pulses, whatever the helper says.

### If you keep your own dashboard YAML

The helper file and the new helper are not enough: the setting lives in the
`aurora_person` template of `dashboard/aurora.yaml`. If you maintain your own
copy of the dashboard YAML (or pasted an older one), copy these two changes
into your `aurora_person` template (from 2.37.0 on):

1. Re-render the card when the helper changes:

```yaml
  aurora_person:
    # ...
    triggers_update:
    - input_select.person_pulse
```

2. Replace the value of `--aurora-person-anim` under `styles` → `card`:

```yaml
      - --aurora-person-anim: |-
          [[[
            const st = entity ? entity.state : 'unknown';
            if (st !== 'home' && st !== 'not_home') return 'none';
            // Setting: input_select.person_pulse, options in this order:
            // Always (default) / On change / Off. Read by position so the options can
            // carry any language; a missing or unavailable helper means Always.
            const h = states['input_select.person_pulse'];
            const o = h?.attributes?.options;
            const i = Array.isArray(o) ? o.indexOf(h.state) : -1;
            if (i === 2) return 'none';
            if (i === 1) {
              // Two beats (5 s) after the change, counted from last_changed so a page
              // reload in the middle picks up where the beat would be.
              const age = Math.max(0, (Date.now() - new Date(entity?.last_changed).getTime()) / 1000);
              return age < 5 ? 'aurora-person-puls 2.5s ease-in-out -' + age.toFixed(2) + 's 2' : 'none';
            }
            return 'aurora-person-puls 3s ease-in-out infinite';
          ]]]
```

(`[[[ ... ]]]` is the button-card JavaScript template syntax; keep the
brackets.) Without these two changes the card keeps pulsing as before and
ignores the setting.

## Keeping switches out of the counter

The **Switches on** tile counts every `switch.*` entity that is on. A socket
that is always on (router, aquarium pump) or a status LED exposed as a switch
would keep that number above zero forever. List them in `switch_ignore`, in the
tile's `variables` in `dashboard/aurora.yaml`:

```yaml
- type: custom:button-card
  template: aurora_chip_kompakt
  label: Switches on
  variables:
    switch_ignore:
    - switch.router_socket      # an exact entity id
    - switch.*_led              # or a pattern: * matches any characters
```

Matching is case-insensitive. An empty list (the default) counts everything.
If you keep your own dashboard YAML, copy the `variables` block and the new
`name` template of that tile; the helper file is unchanged. The ignored
switches still appear in the lights view and are still switchable there.
`python scripts/check_dashboard.py` runs the tile's template against sample
states to verify this.

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

## Tappable rows and jump targets

Any element the helper can see — including one produced by a button-card
`custom_fields` template, inside the card's shadow root — becomes tappable by
carrying a marker:

```html
<!-- opens a sheet explaining the finding -->
<div data-aurora-detail='{"t":"A battery is getting weak",
     "s":"Dimmer, 13 %","w":"Why this matters …",
     "f":["First thing to do","Second thing"],
     "n":"/my-dashboard/devices","nl":"To the devices view",
     "e":"sensor.dimmer_battery","i":"mdi:battery-alert-variant","c":"#f9e2af"}'
     onclick="window.auroraDetail&&window.auroraDetail(this)"
     role="button" tabindex="0"> … </div>

<!-- jumps straight to another view -->
<div data-aurora-nav="/my-dashboard/home"
     onclick="window.auroraNav&&window.auroraNav(this)"
     role="button" tabindex="0"> … </div>
```

The payload keys are short because the whole object travels inside an HTML
attribute: `t` title, `s` subtitle, `w` why, `f` list of steps, `n` navigation
target, `nl` its button label, `e` entity for the more-info dialog, `i` icon,
`c` accent colour. Everything but `t` is optional.

Two things the card has to bring itself, both in its `extra_styles`:

```css
/* button-card puts `disabled` on the ha-card when tap_action is none,
   and that carries pointer-events: none — give them back */
ha-card.disabled { pointer-events: auto !important; cursor: default !important; }
/* without this the browser keeps a double-tap open and hesitates */
.my-row { touch-action: manipulation; }
```

The `onclick` attribute is not decoration — it is what tells Safari the element
is clickable at all. Enter and Space work too, as long as the element carries
`role="button"` and `tabindex="0"`.

Since 2.40.2 the helper hands the pointer back by itself to every silent card
(`tap_action: none`) that carries something to press: an embedded page in an
`<iframe>`, a link, a button, a field, an element with `onclick` or
`role="button"`. Keep the `ha-card.disabled` line in your own templates anyway:
it also works with an older helper, and `scripts/check_dashboard.py` asks for it.

## Performance notes

Everything below was measured with Chrome's `Performance.getMetrics` over 15 s
of idle time on a real installation (1450 entities), not guessed.

- **Keep views small.** One view holding every room measured **~73 % CPU while
  idle**; the same content split into one view per room runs at **9–29 %**. A
  browser pays for every card that exists, not just the visible ones — so
  splitting is by far the biggest lever.
- **Never inject the same CSS into every card.** Shadow DOM has no shared
  stylesheet unless you make one. Appending a `<style>` block per card put
  **428 kB of duplicated CSS in 175 stylesheets** into a single room view, all
  of it re-matched on every style recalculation; a shared constructable
  `CSSStyleSheet` adopted by each root brought that to **89 kB in 13**. The same
  applies to a button-card template's `extra_styles`: it is copied into every
  card that inherits it.
- **Do not iterate `hass.states` from a card template.** button-card hands the
  template a proxy, so `Object.values(hass.states)` is one trapped property read
  per entity — 1450 of them, per chip, per render, and a chip usually evaluates
  its text, its colour and its animation separately. Filter the *keys* by domain
  first and read only what survives: on the Overview that was **~46 % → ~20 %**
  idle CPU.
- **Test in WebKit, not only in Chrome.** Every browser on iOS *is* Safari —
  Apple requires WebKit there — so a dashboard that is smooth in Chrome can be
  unusable on an iPhone. Measured in real WebKit, a room view with 92 cards and
  four `apexcharts-card`s took **160 s to finish and scrolled at 4 fps**; the
  same view with the charts removed took 2.3 s. Each chart forces layout
  measurements while drawing, and WebKit re-lays-out the *whole* page for each
  one — so the cost is charts × page complexity, not charts + page. Four charts
  alone, in a view of their own, render in 1 s. Aurora therefore uses the much
  lighter **mini-graph-card** for the per-room trends and keeps apexcharts for
  the analysis views, where the charts *are* the content: **160 s → 4.7 s**,
  4 fps → 53 fps.
- **Firefox gets the glass without the blur.** With the animated sky behind
  them, every blurred card is recomputed on every frame. Measured on desktop
  Firefox (2560 px, 166 Hz): ~92 % GPU load as shipped, ~21–25 % with the
  per-card blur off and every animation still running — the blur alone was
  about 70 % of the load. Firefox therefore keeps the sheen and the edge light
  but gets a more opaque card colour instead of the blur; Chrome, Edge and
  Safari are unchanged. Two optional theme variables override this in any
  browser: `aurora-glass-blur` (`none`, or a filter such as
  `blur(18px) saturate(1.45)` to bring the blur back in Firefox) and
  `aurora-glass-solid` (the card colour used where the blur is off).
- **Phones need less, not smaller.** Under 700 px this dashboard drops the
  per-card backdrop blur (each blurred card is a compositing layer plus a
  backdrop snapshot, at 3× device pixels), freezes the sky's motion while
  keeping its picture, and stops idle decoration — while animations that carry
  meaning keep running. An animated icon delivered as an **SVG image** cannot be
  paused by CSS or JavaScript at all (it animates inside its own document), so
  swap the card itself behind a `conditional` card with a `screen` condition.
- **`triggers_update: all` is expensive.** A card with it re-renders on *every*
  state change anywhere in Home Assistant. 66 such cards produced 120 style
  recalculations per second. Bind cards to the entities they actually read.
- **Animation inside a glass card repaints the glass.** Animating `box-shadow`
  or `filter` in a card that has `backdrop-filter` forces the blur behind it to
  be recomputed every frame — a *single* permanently pulsing badge cost 9 % CPU
  on its own. Fixes used here: animate `transform`/`opacity` only, give animated
  elements their own layer with `will-change`, and only animate when the state
  actually says something (a window badge pulses when the window is open, not
  always).
- **The sky is free — but only because of how it is built.** Measured on the
  Overview: **Day ≈ 16 %, Night ≈ 23 %, Dusk ≈ 24 %** idle CPU, and switching
  every sky animation off live changed the figure by **0.4 %** — i.e. nothing
  outside the noise of live sensor data. The weather layers cost nothing
  either: sunny 24.9 %, overcast 19.4 %, **heavy rain 15.5 %**, snow 16.0 %,
  thunderstorm 21.0 % — the spread is measurement noise, not the animation.
  That holds only because each scene animates `transform`/`opacity`
  exclusively, drifts an oversized layer instead of a `background-position`,
  and never has more than one scene in the DOM. Animate a paint property there
  instead and every glass card on top of it has to re-blur on every frame.
- **A helper that walks the page must read first and write afterwards.** The
  effects helper sweeps the page for new cards. It used to alternate per card:
  ask for a computed style, write a stylesheet, ask for the next one — and every
  write made the page's styles stale, so every following read forced a fresh
  style recalculation (one per card). In a room view on a Raspberry Pi, in real
  WebKit, a single sweep took **5–10 s**; asking a trend tile for its width in
  the middle of a sweep forced a layout of the whole page on top. Since 2.41.0 a
  sweep reads everything first and writes afterwards, the axis width comes from a
  `ResizeObserver` (which also follows a rotated phone), and during the build the
  helper waits at least three times as long as its last sweep took, so it never
  takes more than a quarter of the main thread. Summed over the twelve views of
  the demo instance, sweep time fell from **23.2 s to 14.1 s** (living room
  6.7 → 3.4 s, system 1.6 → 0.24 s, lights 3.3 → 1.3 s); what is left is the
  browser styling a page that was only just built.
- **Idle decoration that is switched off must not keep its layer.** The helper
  turns the float/swing/bob/shimmer animations of idle icons off everywhere, but
  the rule that gives an animated icon its own compositor layer matched them
  anyway (`style*="aurora-"`): 50 promoted elements on the Overview, 36 in a room
  view. Now the same rule that removes the animation also removes the layer
  (34 and 29), and the shipped templates no longer emit those animations at all
  — each one was a JavaScript template evaluated per icon and render.
- **Measure it yourself.** `tools/perf/measure.py` loads every view in WebKit
  against the throwaway demo instance (`tools/demo/demo.sh up`) and prints build
  time, rendered cards, main-thread blocking, sweep time and promoted layers. Run
  it twice, once with `--helper <older file>`, to compare two versions in the same
  browser on the same machine; wall-clock numbers move with the load of the
  machine, the layer count and the order of reads and writes do not (they are
  what `tests/test_perf_budget.py` pins).
- Animations on cards scrolled out of view are paused automatically
  (IntersectionObserver in the effects helper).
- Counter chips and button animations run entirely in the browser.
- `auto-entities` filters use include/exclude patterns only — **never** its
  `template:` filter (that would subscribe a backend template).
- If you add your own cards: put expensive Jinja (`integration_entities`,
  `device_entities`, `states.x` scans) into a *template sensor* with a time
  trigger, never onto a card. Cards re-render on every state change.

## License

Source-available, © Robert Manuwald: free to download and **use** on your own
Home Assistant installation (including adapting entity IDs to your setup).
Modification beyond that, redistribution, and derivative works are not
permitted — see [LICENSE](LICENSE).
