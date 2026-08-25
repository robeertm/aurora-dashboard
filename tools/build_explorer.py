#!/usr/bin/env python3
"""Build the sparkline explorer views for an Aurora dashboard.

`auto-entities` cannot produce one chart per entity: it injects `entity:` into
every generated card, and `mini-graph-card` insists on an `entities:` LIST. So
the tiles are generated here instead — read the live states once, write the
views back through the WebSocket API.

Two views are written, because the tiles have a measured ceiling of roughly
250 per view before a phone starts to stutter:

  explorer    every measurement class (temperature … gas), one section each
  other       counters, enums, timestamps, binary sensors AND per-device network
              rates — as plain lists. A curve of a monotonic counter says
              nothing, and most per-device rates read 0.00 all day: mini-graph
              then scales into the noise and paints a bright hill where there is
              no traffic at all.

Usage:  HA_URL=http://homeassistant.local:8123 HA_TOKEN=... \
        python3 tools/build_explorer.py [dashboard-url-path]
"""
import asyncio, json, os, sys

try:
    import websockets
except ImportError:
    sys.exit("pip install websockets")

URL = os.environ.get("HA_URL", "").rstrip("/")
TOKEN = os.environ.get("HA_TOKEN", "")
DASH = sys.argv[1] if len(sys.argv) > 1 else "aurora-home"
if not URL or not TOKEN:
    sys.exit("set HA_URL and HA_TOKEN")

# device class -> (section title, accent). Every accent is a Catppuccin tone the
# dashboard already uses elsewhere; the explorer introduces no new colour.
CLASSES = [
    ("temperature",     "Temperature",   "#cba6f7"),
    ("humidity",        "Humidity",      "#89dceb"),
    ("pressure",        "Pressure",      "#b4befe"),
    ("illuminance",     "Illuminance",   "#f9e2af"),
    ("power",           "Power",         "#fab387"),
    ("energy",          "Energy",        "#f9e2af"),
    ("monetary",        "Cost",          "#f5c2e7"),
    ("battery",         "Battery",       "#a6e3a1"),
    ("signal_strength", "Signal",        "#89dceb"),
    ("voltage",         "Voltage",       "#b4befe"),
    ("current",         "Current",       "#89b4fa"),
    ("frequency",       "Frequency",     "#94e2d5"),
    ("power_factor",    "Power factor",  "#94e2d5"),
    ("duration",        "Durations",     "#a6adc8"),
    ("water",           "Water",         "#89dceb"),
    ("gas",             "Gas",           "#fab387"),
]
HOURS = 6
# Classes whose natural floor is zero. Without a fixed lower bound mini-graph
# zooms into the last digit of a flat series and draws a hill out of nothing.
ZERO_FLOOR = {"power", "energy", "illuminance", "current", "water", "gas",
              "monetary", "duration", "power_factor"}
PERCENT = {"battery", "humidity"}


async def call(ws, i, msg):
    msg = dict(msg, id=i)
    await ws.send(json.dumps(msg))
    while True:
        r = json.loads(await ws.recv())
        if r.get("id") == i and r.get("type") == "result":
            if not r.get("success"):
                sys.exit(f"HA said no: {r}")
            return r["result"]


def numeric(state):
    try:
        float(state["state"])
        return True
    except (TypeError, ValueError):
        return False


def tile(state, colour):
    name = state["attributes"].get("friendly_name") or state["entity_id"].split(".", 1)[1]
    dc = state["attributes"].get("device_class")
    bounds = {"lower_bound": 0} if dc in ZERO_FLOOR else {}
    if dc in PERCENT:
        bounds = {"lower_bound": 0, "upper_bound": 100}
    return {
        "type": "custom:stack-in-card", "mode": "vertical",
        "cards": [
            {"type": "custom:button-card", "template": "aurora_plot_tile",
             "entity": state["entity_id"], "name": name, "label": f"{HOURS} h",
             "variables": {"accent": colour}},
            {"type": "custom:mini-graph-card",
             "entities": [{"entity": state["entity_id"], "color": colour}],
             "hours_to_show": HOURS, "points_per_hour": 2, "line_width": 1.5,
             "animate": False, "hour24": True, "smoothing": True, "height": 46,
             "update_interval": 300,
             "show": {"name": False, "icon": False, "state": False, "legend": False,
                      "fill": "fade", "labels": False, "extrema": False, "points": False},
             **bounds},
        ]}


def section(title, tiles):
    """One glass card per class, two tiles per row.

    Each tile in its own card measured 18.5 fps against 44 for this shape, and a
    `grid` with `columns: 2` collapses to a single column inside a stack-in-card
    — hence the rows of two.
    """
    rows = []
    for i in range(0, len(tiles), 2):
        pair = tiles[i:i + 2]
        if len(pair) == 1:
            pair = pair + [{"type": "grid", "cards": []}]   # keep the last one half width
        rows.append({"type": "custom:stack-in-card", "mode": "horizontal", "cards": pair})
    return {"type": "grid", "column_span": 1, "cards": [
        {"type": "heading", "heading": f"{title} · {len(tiles)}",
         "heading_style": "title", "icon": "mdi:chart-line"},
        {"type": "custom:stack-in-card", "mode": "vertical",
         "grid_options": {"columns": "full"}, "cards": rows}]}


def sections_for(states, classes):
    out = []
    for dc, title, colour in classes:
        ents = sorted((s for s in states
                       if s["entity_id"].startswith("sensor.")
                       and s["attributes"].get("device_class") == dc
                       and numeric(s)),
                      key=lambda s: (s["attributes"].get("friendly_name") or "").lower())
        if ents:
            out.append(section(title, [tile(s, colour) for s in ents]))
    return out


async def main():
    ws_url = URL.replace("http", "ws", 1) + "/api/websocket"
    async with websockets.connect(ws_url, max_size=200 * 1024 * 1024) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "auth", "access_token": TOKEN}))
        if json.loads(await ws.recv())["type"] != "auth_ok":
            sys.exit("token rejected")
        cfg = await call(ws, 1, {"type": "lovelace/config", "url_path": DASH})
        states = await call(ws, 2, {"type": "get_states"})

        view = next((v for v in cfg["views"] if v.get("path") == "explorer"), None)
        if not view:
            sys.exit("no view with path 'explorer' in this dashboard")
        head = view["sections"][0]
        lists = [s for s in view["sections"][1:]
                 if any(c.get("type") == "custom:auto-entities" for c in s.get("cards", []))]
        lists += [s for v in cfg["views"] if v.get("path") == "other"
                  for s in v.get("sections", [])[1:]
                  if any(c.get("type") == "custom:auto-entities" for c in s.get("cards", []))]

        view["sections"] = [head] + sections_for(states, CLASSES)
        view["max_columns"] = 3
        rest = {"title": "Other", "path": "other", "icon": "mdi:format-list-bulleted",
                "type": "sections", "max_columns": 3, "sections": [head] + lists}
        cfg["views"] = [v for v in cfg["views"] if v.get("path") not in ("data-rate", "other")]
        i = cfg["views"].index(view)
        cfg["views"][i + 1:i + 1] = [rest]

        await call(ws, 3, {"type": "lovelace/config/save", "url_path": DASH, "config": cfg})
        n = sum(len(s["cards"][1]["cards"]) for s in view["sections"][1:])
        print(f"explorer: {n} rows of tiles · views now {len(cfg['views'])}")


asyncio.run(main())
