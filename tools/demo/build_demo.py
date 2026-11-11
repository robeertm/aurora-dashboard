#!/usr/bin/env python3
"""Build the throwaway demo instance's config directory (./run/config).

Everything shown in the screenshots is invented here: one person ("Alex"),
five rooms, made-up sensors, made-up history. Nothing is read from a real
installation. The result is a plain Home Assistant config folder plus a tiny
custom component (`aurora_demo_seed`) that writes the invented states -
including their history - when the container starts.

    python3 tools/demo/build_demo.py          # (re)creates tools/demo/run
"""
import colorsys
import json
import math
import os
import random
import shutil
import sys
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
RUN = os.path.join(HERE, "run")
CONF = os.path.join(RUN, "config")
TZ = ZoneInfo("Europe/Rome")
RNG = random.Random(20261111)  # same picture every run
HIST = 24 * 3600
STEP = 600

# ── helpers ──────────────────────────────────────────────────────────────────
ENT = {}


def add(eid, state, attrs=None, hist=None):
    """hist = [(seconds_before_now, state, attrs|None)], oldest first. The last
    point is the entity's current state."""
    attrs = dict(attrs or {})
    h = hist if hist else [(5, state, None)]
    ENT[eid] = {"id": eid, "state": str(state), "attrs": attrs,
                "hist": [[o, str(s), a] for o, s, a in h]}


def curve(base, amp, phase=0.0, noise=0.0, step=STEP, span=HIST, lo=None, hi=None,
          dec=1, end=None):
    """A smooth day curve ending exactly on `end` (or its natural value)."""
    pts = []
    n = span // step
    for i in range(n, -1, -1):
        t = i * step
        x = (span - t) / span
        v = base + amp * math.sin(2 * math.pi * (x + phase)) + RNG.uniform(-noise, noise)
        if lo is not None:
            v = max(lo, v)
        if hi is not None:
            v = min(hi, v)
        pts.append([t, round(v, dec)])
    pts[-1][0] = 5
    if end is not None:
        # ease the curve onto the wanted last value over the final 4 hours,
        # so the picture has no jump at its right edge
        delta = end - pts[-1][1]
        for p in pts:
            if p[0] < 4 * 3600:
                k = 1 - p[0] / (4 * 3600)
                v = p[1] + delta * k * k * (3 - 2 * k)
                if lo is not None:
                    v = max(lo, v)
                if hi is not None:
                    v = min(hi, v)
                p[1] = round(v, dec)
        pts[-1][1] = end
    return [(o, v, None) for o, v in pts]


def sensor(eid, name, unit, cls=None, sc="measurement", **kw):
    attrs = {"friendly_name": name}
    if unit:
        attrs["unit_of_measurement"] = unit
    if cls:
        attrs["device_class"] = cls
    if sc:
        attrs["state_class"] = sc
    return attrs, kw


def num(eid, name, unit, base, amp, cls=None, phase=0.0, noise=0.0, lo=None,
        hi=None, dec=1, end=None, sc="measurement"):
    attrs, _ = sensor(eid, name, unit, cls, sc)
    h = curve(base, amp, phase, noise, lo=lo, hi=hi, dec=dec, end=end)
    add(eid, h[-1][1], attrs, h)


# ── the invented home ────────────────────────────────────────────────────────
ROOMS = ["living_room", "kitchen", "bedroom", "office", "bathroom"]
NICE = {"living_room": "Living Room", "kitchen": "Kitchen", "bedroom": "Bedroom",
        "office": "Office", "bathroom": "Bathroom", "hallway": "Hallway"}


def build_entities():
    ENT.clear()
    # people: one home for hours, one away for hours, one just back
    for pid, nm, hist in (
            ("alex", "Alex", [(14 * 3600, "not_home", None), (int(3.2 * 3600), "home", None)]),
            ("sam", "Sam", [(20 * 3600, "home", None), (int(5.0 * 3600), "not_home", None)]),
            ("robin", "Robin", [(9 * 3600, "not_home", None), (40 * 60, "home", None)])):
        add("person." + pid, hist[-1][1], {"friendly_name": nm, "id": pid,
                                           "device_trackers": [], "editable": False}, hist)

    for nm, cur, tgt in (("Hallway", 19.6, 19.0), ("Guest Room", 17.1, 17.0), ("Attic", 18.8, 19.0)):
        add("climate.trv_" + nm.lower().replace(" ", "_"), "heat",
            {"friendly_name": "TRV " + nm, "current_temperature": cur, "temperature": tgt,
             "hvac_modes": ["heat", "off"], "min_temp": 5, "max_temp": 30, "target_temp_step": 0.5,
             "hvac_action": "idle", "supported_features": 1})
    for who, st in (("alex", "home"), ("robin", "home"), ("sam", "not_home")):
        add("device_tracker.%s_phone" % who, st,
            {"friendly_name": "%s Phone" % who.capitalize(), "source_type": "router"})
    add("device_tracker.living_room_laptop", "home",
        {"friendly_name": "Living Room Laptop", "source_type": "router"})

    # weather helpers
    num("sensor.outdoor_temperature", "Outdoor Temperature", "°C", 9.6, 3.4,
        "temperature", phase=0.03, noise=0.12, end=11.8)

    setp = {"living_room": 21.0, "kitchen": 20.5, "bedroom": 18.0, "office": 21.0,
            "bathroom": 22.0}
    now_t = {"living_room": 21.1, "kitchen": 20.4, "bedroom": 18.2, "office": 19.4,
             "bathroom": 21.7}
    for i, r in enumerate(ROOMS):
        num("sensor.room_temp_" + r, NICE[r] + " Temperature", "°C", now_t[r] - 0.1, 0.9,
            "temperature", phase=0.1 * i + 0.05, noise=0.07, end=now_t[r])
        win_open = r == "office"
        add("binary_sensor.window_" + r, "on" if win_open else "off",
            {"friendly_name": "Window " + NICE[r], "device_class": "window"},
            [(HIST, "off", None), (int(0.6 * 3600), "on", None)] if win_open
            else [(HIST, "off", None)])
        batt = {"living_room": 91, "kitchen": 88, "bedroom": 84, "office": 14, "bathroom": 79}[r]
        add("sensor.window_%s_battery" % r, batt,
            {"friendly_name": "Window %s Battery" % NICE[r], "device_class": "battery",
             "unit_of_measurement": "%", "state_class": "measurement"})
        add("sensor.trv_%s_battery" % r, {"living_room": 77, "kitchen": 82, "bedroom": 90,
                                          "office": 68, "bathroom": 73}[r],
            {"friendly_name": "TRV %s Battery" % NICE[r], "device_class": "battery",
             "unit_of_measurement": "%", "state_class": "measurement"})
        heating = now_t[r] < setp[r] - 0.2
        valve = 62 if r == "office" else (18 if heating else 0)
        vh = curve(18, 16, 0.05 * i, 3, lo=0, hi=100, dec=0, end=valve)
        add("sensor.trv_%s_valve" % r, valve,
            {"friendly_name": "TRV %s Valve" % NICE[r], "unit_of_measurement": "%",
             "state_class": "measurement"}, vh)
        add("climate.trv_" + r, "heat",
            {"friendly_name": "TRV " + NICE[r], "current_temperature": now_t[r],
             "temperature": setp[r], "hvac_modes": ["heat", "off"], "min_temp": 5,
             "max_temp": 30, "target_temp_step": 0.5,
             "hvac_action": "heating" if heating else "idle", "supported_features": 1})
    for r, base in (("living_room", 46), ("kitchen", 52)):
        num("sensor.%s_humidity" % r, NICE[r] + " Humidity", "%", base, 4, "humidity",
            phase=0.3, noise=0.8, dec=0, end=base)
    for k in (1, 2):
        num("sensor.room_temp_kids_room_%d" % k, "Kids Room %d Temperature" % k, "°C",
            round(20.3 + 0.2 * k, 1), 0.5, "temperature", phase=0.15 * k, noise=0.05, end=round(20.4 + 0.2 * k, 1))

    # lights
    L = {
        "living_room": ("Living Room Ceiling", "on", 178, 2700, None, ["color_temp", "hs"]),
        "kitchen": ("Kitchen Spots", "on", 255, 4000, None, ["color_temp"]),
        "bedroom": ("Bedroom Lamp", "off", None, None, None, ["color_temp", "hs"]),
        "office": ("Office Desk", "off", None, None, None, ["color_temp", "hs"]),
        "bathroom": ("Bathroom Mirror", "off", None, None, None, ["onoff"]),
        "hallway": ("Hallway", "on", 80, 2200, None, ["brightness"]),
    }
    for r, (nm, st, br, k, hs, modes) in L.items():
        a = {"friendly_name": nm, "supported_color_modes": modes, "supported_features": 0}
        if st == "on":
            a.update({"brightness": br, "color_mode": "color_temp" if "color_temp" in modes else "brightness"})
            if k and "color_temp" in modes:
                a.update({"color_temp_kelvin": k, "rgb_color": kelvin_rgb(k)})
        add("light." + r, st, a, light_history(r, st, br, k, modes, a))
    add("switch.coffee_machine", "off", {"friendly_name": "Coffee Machine"})
    add("switch.garden_pump", "off", {"friendly_name": "Garden Pump"})
    for r, nms in {"living_room": ("Relax", "Movie"), "kitchen": ("Cooking", "Dinner"),
                   "bedroom": ("Sleep", "Wake up"), "office": ("Focus",),
                   "bathroom": ("Bright",), "hallway": ("Night path",)}.items():
        for s in nms:
            add("scene.%s_%s" % (r, s.lower().replace(" ", "_")), "2026-11-10T18:30:00+00:00",
                {"friendly_name": NICE[r] + " " + s})
    for r in ROOMS:
        add("automation.%s_motion_light" % r, "on",
            {"friendly_name": NICE[r] + " Motion Light", "last_triggered": None, "mode": "single"})
    add("automation.away_all_off", "on", {"friendly_name": "Away: everything off", "mode": "single"})
    add("automation.heating_holiday", "off", {"friendly_name": "Holiday heating", "mode": "single"})

    # media
    add("media_player.living_room_tv", "playing",
        {"friendly_name": "Living Room TV", "media_title": "Ocean Planet", "media_artist": "Documentary",
         "supported_features": 21389})
    add("media_player.kitchen_speaker", "playing",
        {"friendly_name": "Kitchen Speaker", "media_title": "Evening Jazz", "media_artist": "Studio Quartet",
         "supported_features": 21389})
    add("media_player.bedroom_speaker", "idle",
        {"friendly_name": "Bedroom Speaker", "supported_features": 21389})
    add("update.home_assistant_core", "on",
        {"friendly_name": "Home Assistant Core Update", "installed_version": "2026.11.0",
         "latest_version": "2026.11.1", "supported_features": 0})

    # energy
    num("sensor.circuit_house_power", "House Power", "W", 480, 260, "power", phase=-0.1, noise=60, lo=140, dec=0, end=620)
    num("sensor.circuit_boiler_power", "Boiler Power", "W", 150, 140, "power", phase=0.3, noise=30, lo=0, dec=0, end=95)
    num("sensor.circuit_lights_power", "Lights Power", "W", 60, 50, "power", phase=0.2, noise=10, lo=5, dec=0, end=74)
    wb = [(o, v, None) for o, v in zip(range(HIST, 0, -STEP), [0] * 58 + [7400] * 20 + [0] * 66)]
    wb.append((5, 0, None))
    add("sensor.circuit_wallbox_power", 0, {"friendly_name": "Wallbox Power", "device_class": "power",
        "unit_of_measurement": "W", "state_class": "measurement"}, wb)
    tot = {}
    hh = []
    hs = {k: ENT["sensor.circuit_%s_power" % k]["hist"] for k in ("house", "boiler", "lights")}
    for idx, (o, _, _) in enumerate(wb):
        v = sum(float(hs[k][idx][1]) for k in hs) + float(wb[idx][1]) + 120 + RNG.uniform(-25, 25)
        hh.append((o, round(v), None))
    hh[-1] = (5, 1105, None)
    # keep the breakdown consistent with the current total
    cur = {"house": 620, "boiler": 95, "lights": 74, "wallbox": 0}
    other = 1105 - sum(cur.values())
    num("sensor.other_power", "Other Power", "W", 150, 60, "power", phase=0.4, noise=25, lo=40, dec=0, end=other)
    add("sensor.total_power", 1105, {"friendly_name": "Total Power", "device_class": "power",
                                     "unit_of_measurement": "W", "state_class": "measurement"}, hh)
    # kWh today: sawtooth over 14 days, resets at local midnight
    eh = []
    now = datetime.now(TZ)
    start = now - timedelta(days=14)
    t = start
    acc = 0.0
    daily = [11.2, 9.8, 12.9, 8.7, 10.4, 13.6, 14.1, 9.2, 10.9, 11.8, 12.2, 8.4, 10.1]
    di = 0
    while t <= now:
        if t.hour == 0 and t.minute < 30:
            acc = 0.0
        frac = (t.hour * 60 + t.minute) / 1440
        tgt = daily[di % len(daily)] if True else 0
        acc = tgt * min(1.0, frac ** 0.9) if frac > 0 else 0.0
        if t.hour == 23 and t.minute >= 30:
            di += 1
        eh.append((int((now - t).total_seconds()), round(acc, 2), None))
        t += timedelta(minutes=30)
    cur_kwh = round(float(daily[(di) % len(daily)]) * min(1.0, ((now.hour * 60 + now.minute) / 1440) ** 0.9), 2)
    eh[-1] = (5, cur_kwh, None)
    add("sensor.total_energy_today", cur_kwh, {"friendly_name": "Total Energy Today", "device_class": "energy",
        "unit_of_measurement": "kWh", "state_class": "total_increasing"}, eh)
    for k, share, nm in (("boiler", 0.22, "Boiler"), ("lights", 0.07, "Lights"),
                         ("wallbox", 0.0, "Wallbox"), ("other", 0.31, "Other")):
        add("sensor.%s_energy_today" % ("circuit_" + k if k != "other" else "other"),
            round(cur_kwh * share + (3.4 if k == "wallbox" else 0), 2),
            {"friendly_name": nm + " Energy Today", "device_class": "energy",
             "unit_of_measurement": "kWh", "state_class": "total_increasing"})
    add("sensor.circuit_house_energy_today", round(cur_kwh * 0.4, 2),
        {"friendly_name": "House Energy Today", "device_class": "energy",
         "unit_of_measurement": "kWh", "state_class": "total_increasing"})
    add("sensor.total_cost_today", round(cur_kwh * 0.31, 2),
        {"friendly_name": "Cost Today", "device_class": "monetary", "unit_of_measurement": "EUR"})

    # network
    num("sensor.wan_download_rate", "WAN Download", "Mbit/s", 38, 30, None, phase=0.2, noise=9, lo=1, end=42.5)
    num("sensor.wan_upload_rate", "WAN Upload", "Mbit/s", 6, 4, None, phase=0.3, noise=1.5, lo=0.2, end=5.1)
    for per, d, u in (("today", 18.4, 2.1), ("week", 112, 14), ("month", 436, 61)):
        add("sensor.wan_download_" + per, d, {"friendly_name": "WAN Download " + per, "unit_of_measurement": "GB"})
        add("sensor.wan_upload_" + per, u, {"friendly_name": "WAN Upload " + per, "unit_of_measurement": "GB"})
    for dev in ("laptop", "phone", "tv", "tablet"):
        num("sensor.devtraffic_%s_v4" % dev, "Traffic %s" % dev, "Mbit/s",
            RNG.uniform(1, 8), 2, None, phase=RNG.random(), noise=0.7, lo=0, end=round(RNG.uniform(0.4, 6), 1))
    add("sensor.your_router_poe_power", 21.4, {"friendly_name": "Router PoE Power", "unit_of_measurement": "W",
        "device_class": "power", "state_class": "measurement"})

    # radio
    for i, rssi in ((1, -66), (2, -74)):
        num("sensor.ble_scanner_%d_rssi_avg" % i, "BLE Scanner %d RSSI" % i, "dBm", rssi, 3,
            "signal_strength", phase=0.1 * i, noise=1.5, dec=0, end=rssi)
        add("sensor.ble_scanner_%d_unique_devices" % i, 31 + i * 7, {"friendly_name": "BLE Scanner %d Devices" % i, "state_class": "measurement"})
        add("sensor.ble_scanner_%d_adverts" % i, 410 + i * 90, {"friendly_name": "BLE Scanner %d Adverts" % i, "state_class": "measurement"})

    # the server
    num("sensor.your_server_cpu_usage", "Server CPU Usage", "%", 14, 9, None, phase=0.1, noise=4, lo=2, dec=0, end=12)
    num("sensor.your_server_cpu_user", "Server CPU User", "%", 9, 6, None, phase=0.1, noise=3, lo=1, dec=0, end=8)
    num("sensor.your_server_cpu_system", "Server CPU System", "%", 4, 2, None, phase=0.2, noise=1.5, lo=0, dec=0, end=3)
    num("sensor.your_server_cpu_io_wait", "Server CPU IO Wait", "%", 1, 1, None, phase=0.3, noise=0.8, lo=0, dec=0, end=1)
    num("sensor.your_server_cpu_temperature", "Server CPU Temperature", "°C", 51, 5, "temperature", phase=0.1, noise=1, end=49.6)
    num("sensor.your_server_memory_usage", "Server Memory Usage", "%", 41, 4, None, phase=0.5, noise=1, dec=0, end=40)
    num("sensor.your_server_memory_used", "Server Memory Used", "MB", 3300, 240, None, phase=0.5, noise=60, dec=0, end=3270)
    num("sensor.your_server_cache_buffer", "Server Cache and Buffers", "MB", 2100, 160, None, phase=0.6, noise=40, dec=0, end=2150)
    num("sensor.your_server_swap_used", "Server Swap Used", "MB", 120, 30, None, phase=0.7, noise=10, dec=0, end=118)
    num("sensor.your_server_disk_usage", "Server Disk Usage", "%", 34, 0.4, None, noise=0.1, end=34)
    num("sensor.your_server_disk_read", "Server Disk Read", "MB/s", 1.4, 1.2, None, phase=0.2, noise=0.6, lo=0, end=0.9)
    num("sensor.your_server_disk_write", "Server Disk Write", "MB/s", 2.2, 1.6, None, phase=0.25, noise=0.8, lo=0, end=1.7)
    num("sensor.your_server_network_rx", "Server Network In", "Mbit/s", 4.5, 3.5, None, phase=0.2, noise=1.5, lo=0.1, end=4.2)
    num("sensor.your_server_network_tx", "Server Network Out", "Mbit/s", 1.4, 1.1, None, phase=0.3, noise=0.5, lo=0.05, end=1.2)
    add("sensor.your_server_health_score", 96, {"friendly_name": "Server Health Score", "unit_of_measurement": "%", "state_class": "measurement"})
    add("sensor.your_server_sd_wear", 6, {"friendly_name": "Server Disk Wear", "unit_of_measurement": "%", "state_class": "measurement"})
    add("sensor.your_server_sd_years_left", 14.2, {"friendly_name": "Server Disk Years Left", "unit_of_measurement": "years"})
    add("sensor.your_server_uptime", 17.3, {"friendly_name": "Server Uptime", "unit_of_measurement": "d"})
    add("sensor.your_server_written_today", 2.8, {"friendly_name": "Server Written Today", "unit_of_measurement": "GB"})
    add("sensor.your_server_read_today", 1.1, {"friendly_name": "Server Read Today", "unit_of_measurement": "GB"})
    return ENT


# ── light history + 24 h strips ──────────────────────────────────────────────
def kelvin_rgb(k):
    t = k / 100.0
    r = 255 if t <= 66 else max(0, min(255, 329.698727446 * ((t - 60) ** -0.1332047592)))
    g = (99.4708025861 * math.log(t) - 161.1195681661) if t <= 66 else 288.1221695283 * ((t - 60) ** -0.0755148492)
    b = 255 if t >= 66 else (0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307)
    c = lambda v: int(max(0, min(255, round(v))))
    return [c(r), c(g), c(b)]


def light_history(room, state, br, k, modes, now_attrs):
    """Invented evening/morning pattern; the last point equals `now_attrs`."""
    pts = []  # (seconds_before_now, state, attrs)
    now = datetime.now(TZ)

    def at(h, m=0, days=0):
        d = (now - timedelta(days=days)).replace(hour=h, minute=m, second=0, microsecond=0)
        return int((now - d).total_seconds())

    def on(sec, kelvin, bri, hs=None):
        if sec <= 0 or sec > HIST:
            return
        a = {"friendly_name": now_attrs["friendly_name"], "supported_color_modes": modes,
             "supported_features": 0, "brightness": bri}
        if hs:
            a.update({"color_mode": "hs", "hs_color": list(hs),
                      "rgb_color": hsv_rgb(hs[0], hs[1])})
        elif kelvin and "color_temp" in modes:
            a.update({"color_mode": "color_temp", "color_temp_kelvin": kelvin,
                      "rgb_color": kelvin_rgb(kelvin)})
        else:
            a["color_mode"] = "brightness" if "brightness" in modes else "onoff"
        pts.append((sec, "on", a))

    def off(sec):
        if sec <= 0:
            return
        pts.append((sec, "off", {"friendly_name": now_attrs["friendly_name"],
                                 "supported_color_modes": modes, "supported_features": 0}))

    def seg(day, h0, m0, h1, m1, k0=None, k1=None, b0=255, b1=None, hs=None, step=25):
        """On from h0:m0 to h1:m1; kelvin and brightness glide like adaptive lighting."""
        t0, t1 = at(h0, m0, day), at(h1, m1, day)
        n = max(1, (t0 - t1) // (step * 60))
        for q in range(n):
            f = q / max(1, n - 1)
            on(t0 - (t0 - t1) * q // n,
               None if k0 is None else int(k0 + (k1 - k0) * f),
               int(b0 + ((b0 if b1 is None else b1) - b0) * f), hs)
        off(t1)

    off(HIST)
    if room == "living_room":
        seg(1, 17, 10, 19, 30, 4500, 3000, 255, 200)
        seg(1, 19, 30, 22, 30, 3000, 2200, 200, 110)
        seg(1, 22, 30, 23, 15, None, None, 70, 45, (28, 80))
        seg(0, 6, 40, 8, 10, 2700, 4000, 150, 220)
    elif room == "kitchen":
        seg(1, 17, 20, 18, 50, 4000, 4000, 255, 255)
        seg(1, 21, 20, 21, 50, 2700, 2700, 90, 90)
        seg(0, 6, 20, 7, 30, 4000, 4000, 255, 255)
    elif room == "hallway":
        for d, a1, a2, c1, c2 in ((1, (17, 45), (18, 0), (19, 55), (20, 5)),
                                  (1, (22, 50), (23, 0), (6, 30), (6, 40))):
            seg(d, a1[0], a1[1], a2[0], a2[1], 2200, 2200, 80, 80, step=60)
            seg(d if c1[0] > 12 else 0, c1[0], c1[1], c2[0], c2[1], 2200, 2200, 80, 80, step=60)
    elif room == "bedroom":
        seg(1, 21, 40, 22, 40, None, None, 90, 25, (24, 70))
        seg(0, 6, 30, 7, 5, 2200, 3500, 90, 160)
    elif room == "office":
        seg(1, 10, 0, 12, 30, 5000, 4600, 255, 255)
        seg(1, 13, 10, 18, 20, 4600, 3800, 255, 230)
        seg(0, 8, 30, 9, 35, 5000, 5000, 255, 255)
    else:  # bathroom
        for d, h0, m0, h1, m1 in ((1, 18, 10, 18, 40), (1, 22, 5, 22, 20), (0, 6, 50, 7, 15)):
            t0, t1 = at(h0, m0, d), at(h1, m1, d)
            on(t0, None, None)
            off(t1)
    pts = [p for p in pts if p is not None and p[0] > 0]
    pts.sort(key=lambda p: -p[0])
    # drop points that would sit before the window
    pts = [(min(o, HIST), s, a) for o, s, a in pts]
    # make the last point equal to the current state
    cur_attrs = dict(now_attrs)
    if not pts or pts[-1][1] != state:
        pts.append((2700 if state == "on" else 5, state, cur_attrs))
    else:
        pts[-1] = (pts[-1][0], state, cur_attrs)
    # strictly descending offsets
    out = []
    for o, s, a in pts:
        if out and o >= out[-1][0]:
            o = out[-1][0] - 60
        out.append((max(o, 5), s, a))
    return out


def hsv_rgb(h, s):
    r, g, b = colorsys.hsv_to_rgb(h / 360.0, s / 100.0, 1.0)
    return [int(r * 255), int(g * 255), int(b * 255)]


def strip_colour(state, bri, rgb):
    if state == "off":
        return "#252538"
    if state != "on":
        return "#45475a"
    if bri is None:
        r, g, b = rgb or [255, 255, 255]
        return "#%02x%02x%02x" % (r, g, b)
    f = max(0.0, min(1.0, bri / 255.0)) ** 0.65
    f = 0.10 + 0.90 * f
    r, g, b = rgb or [255, 255, 255]
    q = lambda v: min(255, int(round(v * f / 3.0)) * 3)
    return "#%02x%02x%02x" % (q(r), q(g), q(b))


def strip_svg(points, now):
    """A plain colour bar; the window is stored in the file itself."""
    W, H = 1440, 40
    start = now - HIST
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" preserveAspectRatio="none" '
             'width="100%%" height="100%%" data-jetzt="%d" data-fenster="%d" shape-rendering="crispEdges">'
             % (W, H, int(now), HIST), '<rect width="%d" height="%d" fill="#0b0b12"/>' % (W, H)]
    xs = lambda ts: max(0.0, min(float(W), (ts - start) / HIST * W))
    segs = []
    for i, p in enumerate(points):
        x0 = xs(p[0])
        x1 = xs(points[i + 1][0]) if i + 1 < len(points) else float(W)
        c = strip_colour(p[1], p[2], p[6] and [int(p[6][j:j + 2], 16) for j in (0, 2, 4)])
        if segs and segs[-1][2] == c:
            segs[-1][1] = x1
        elif x1 - x0 >= 0.05:
            segs.append([x0, x1, c])
    for x0, x1, c in segs:
        parts.append('<rect x="%.2f" width="%.2f" height="%d" fill="%s"/>' % (x0, x1 - x0, H, c))
    for k in range(1, 8):
        strong = k % 2 == 0
        parts.append('<rect x="%.2f" width="%s" height="%d" fill="%s" opacity="%s"/>'
                     % (xs(now - k * 3 * 3600), "1.8" if strong else "1.0", H,
                        "#9399b2" if strong else "#6c7086", "0.50" if strong else "0.26"))
    parts.append("</svg>")
    return "".join(parts)


def write_lightstrips(www):
    out = os.path.join(www, "lichtspur")
    os.makedirs(out, exist_ok=True)
    now = time.time()
    lamps = {}
    for eid, e in ENT.items():
        if not eid.startswith("light."):
            continue
        pts = []
        for off, st, a in e["hist"]:
            a = a or e["attrs"]
            rgb = a.get("rgb_color")
            hs = a.get("hs_color")
            pts.append([int(now - off), st, a.get("brightness"), a.get("color_temp_kelvin"),
                        hs[0] if hs else None, hs[1] if hs else None,
                        "%02x%02x%02x" % tuple(rgb) if rgb else None])
        # the helper reads a point as "valid from here until the next one"
        slug = eid.split(".")[1]
        lamps[slug] = pts
        open(os.path.join(out, slug + ".svg"), "w").write(strip_svg(pts, now))
    json.dump({"jetzt": int(now), "fenster_s": HIST, "lampen": lamps},
              open(os.path.join(out, "werte.json"), "w"))
    json.dump({"jetzt": int(now), "fenster_s": HIST}, open(os.path.join(out, "lichtspur.json"), "w"))


# ── dashboard (a copy of the example, plus a light-trail section) ────────────
STRIP_TEMPLATE = {
    "template": "aurora_base", "show_icon": False, "show_name": True, "show_label": True,
    "tap_action": {"action": "more-info"},
    "label": "[[[\n  if (!entity) return '';\n  if (entity.state !== 'on') return 'off';\n"
             "  const a = entity.attributes, t = [];\n"
             "  if (a.brightness != null) t.push(Math.round(a.brightness / 2.55) + ' %');\n"
             "  if (a.color_temp_kelvin) t.push(a.color_temp_kelvin + ' K');\n"
             "  else if (a.hs_color) t.push(Math.round(a.hs_color[0]) + '° / ' + Math.round(a.hs_color[1]) + ' %');\n"
             "  return t.length ? t.join(' · ') : 'on';\n]]]",
    "styles": {
        "grid": [{"grid-template-areas": "'n l' 's s' 'a a'"}, {"grid-template-columns": "1fr auto"},
                 {"grid-template-rows": "min-content min-content min-content"}, {"row-gap": "6px"}],
        "card": [{"padding": "10px 12px 9px 12px"}],
        "name": [{"grid-area": "n"}, {"justify-self": "start"}, {"font-size": "13px"},
                 {"font-weight": "600"}, {"color": "#cdd6f4"}],
        "label": [{"grid-area": "l"}, {"justify-self": "end"}, {"font-size": "10px"},
                  {"letter-spacing": ".06em"},
                  {"color": "[[[ return entity && entity.state === 'on' ? '#f9e2af' : '#7f849c'; ]]]"}],
        "custom_fields": {"s": [{"grid-area": "s"}], "a": [{"grid-area": "a"}]},
    },
    "custom_fields": {
        "s": "[[[\n  if (!entity) return '';\n  const slug = entity.entity_id.split('.')[1];\n"
             "  const nm = (variables && variables.name) || slug;\n"
             "  return '<div class=\"ls-strip\" role=\"button\" tabindex=\"0\" data-aurora-spur=\"' + slug"
             " + '\" data-spur-name=\"' + nm + '\" data-spur-entity=\"' + entity.entity_id + '\""
             " onclick=\"window.auroraSpur&&window.auroraSpur(this)\"><img alt=\"\" src=\"/local/lichtspur/'"
             " + slug + '.svg?m=' + Math.floor(Date.now() / 60000) + '\"></div>';\n]]]",
        "a": "<div class=\"ls-axis\"><span>24 h ago</span><span>−18 h</span><span>−12 h</span>"
             "<span>−6 h</span><span>now</span></div>",
    },
    "extra_styles": ".ls-strip{height:30px;border-radius:6px;overflow:hidden;background:#0b0b12;"
                    "border:1px solid rgba(147,153,178,.20);cursor:crosshair}"
                    ".ls-strip img{display:block;width:100%;height:100%}"
                    ".ls-axis{display:flex;justify-content:space-between;font-size:9px;"
                    "color:#7f849c;letter-spacing:.04em}",
}


def build_dashboard():
    d = yaml.safe_load(open(os.path.join(REPO, "dashboard", "aurora.yaml")))
    d.pop("aurora_defs", None)
    d["button_card_templates"]["demo_light_strip"] = STRIP_TEMPLATE
    # status card knows the one person
    for v in d["views"]:
        if v["path"] == "licht":
            sec = v["sections"][0]
            names = [("light.living_room", "Living Room Ceiling"), ("light.kitchen", "Kitchen Spots"),
                     ("light.hallway", "Hallway"), ("light.bedroom", "Bedroom Lamp"),
                     ("light.office", "Office Desk"), ("light.bathroom", "Bathroom Mirror")]
            sec["cards"] += [
                {"type": "heading", "heading": "Light trail · 24 h", "heading_style": "title",
                 "icon": "mdi:gradient-horizontal"},
                {"type": "grid", "columns": 2, "square": False, "grid_options": {"columns": "full"},
                 "cards": [{"type": "custom:button-card", "template": "demo_light_strip",
                            "entity": e, "name": n, "variables": {"name": n}} for e, n in names]},
            ]
    txt = yaml.safe_dump(d, sort_keys=False, width=10 ** 6, allow_unicode=True)
    txt = txt.replace("persons: []", "persons:\n        - person.alex\n        - person.sam\n        - person.robin")
    return txt


FORECAST = "[" + ", ".join(
    "{'datetime': (now() + timedelta(days=%d)).isoformat(), 'condition': '%s', 'temperature': %d, "
    "'templow': %d, 'precipitation': %d}" % (i, c, hi, lo, p)
    for i, (c, hi, lo, p) in enumerate([("partlycloudy", 13, 6, 0), ("cloudy", 11, 5, 0),
                                        ("rainy", 10, 4, 3), ("sunny", 14, 5, 0), ("sunny", 15, 7, 0)])) + "]"

FORECAST_H = "[" + ", ".join(
    "{'datetime': (now() + timedelta(hours=%d)).isoformat(), 'condition': 'partlycloudy', "
    "'temperature': %d}" % (i, 11 + round(2 * math.sin(i / 4.0))) for i in range(24)) + "]"

CONFIGURATION = """\
homeassistant:
  name: Demo Home
  latitude: 45.0
  longitude: 10.0
  elevation: 120
  unit_system: metric
  time_zone: Europe/Rome
  currency: EUR
  country: IT
  language: en
  external_url: http://127.0.0.1:18523
  internal_url: http://127.0.0.1:18523

# Deliberately NOT default_config: no discovery, no cloud, no mDNS, no Bluetooth.
frontend:
  themes: !include_dir_merge_named themes
recorder:
  commit_interval: 1
history:
sun:
person:
onboarding:
api:
websocket_api:
config:
aurora_demo_seed:

lovelace:
  mode: yaml
  resources:
    - {url: /local/aurora-effects/aurora-effects.js, type: module}
    - {url: /local/community/button-card/button-card.js, type: module}
    - {url: /local/community/apexcharts-card/apexcharts-card.js, type: module}
    - {url: /local/community/mini-graph-card/mini-graph-card-bundle.js, type: module}
    - {url: /local/community/auto-entities/auto-entities.js, type: module}
    - {url: /local/community/stack-in-card/stack-in-card.js, type: module}
    - {url: /local/community/mushroom/mushroom.js, type: module}
    - {url: /local/community/clock-weather-card/clock-weather-card.js, type: module}
  dashboards:
    aurora-home:
      mode: yaml
      title: Aurora
      icon: mdi:weather-night
      show_in_sidebar: true
      filename: dashboards/aurora.yaml

input_select:
  sky_mode:
    name: Sky mode
    options: [Auto, Day, Dusk, Night]
    initial: Auto
input_number:
%(setpoints)s
template:
  - weather:
      - name: Forecast Home
        unique_id: demo_forecast_home
        condition_template: "partlycloudy"
        temperature_template: "{{ states('sensor.outdoor_temperature') | float(0) }}"
        temperature_unit: "°C"
        humidity_template: "62"
        wind_speed_template: "14"
        wind_speed_unit: "km/h"
        pressure_template: "1016"
        pressure_unit: "hPa"
        forecast_daily_template: >
          {{ %(forecast)s }}
        forecast_hourly_template: >
          {{ %(forecast_h)s }}
"""

MANIFEST = {"domain": "aurora_demo_seed", "name": "Aurora demo seed", "version": "1.0.0",
            "documentation": "https://github.com/robeertm/aurora-dashboard",
            "dependencies": ["recorder"], "codeowners": [], "iot_class": "calculated"}

SEED_PY = '''"""Writes the invented demo states, with their history, at startup."""
import json
import time

from homeassistant.core import HomeAssistant
from homeassistant.helpers.start import async_at_started

DOMAIN = "aurora_demo_seed"


async def async_setup(hass: HomeAssistant, config) -> bool:
    data = json.loads(await hass.async_add_executor_job(
        lambda: open(hass.config.path("demo_seed.json")).read()))

    async def _feed(_hass):
        import asyncio
        now = time.time()
        ev = []
        for e in data["entities"]:
            for off, st, attrs in e["hist"]:
                ev.append((now - off, e["id"], st, attrs if attrs is not None else e["attrs"]))
        ev.sort(key=lambda x: x[0])
        for i, (ts, eid, st, attrs) in enumerate(ev):
            hass.states.async_set(eid, st, attrs, timestamp=ts)
            if i % 400 == 399:
                await asyncio.sleep(0.05)

    async_at_started(hass, _feed)
    return True
'''


def main():
    if os.path.isdir(RUN):
        shutil.rmtree(RUN)
    for d in ("themes", "dashboards", "www/aurora-effects", "www/community",
              "custom_components/aurora_demo_seed"):
        os.makedirs(os.path.join(CONF, d), exist_ok=True)
    build_entities()
    # config
    sp = "\n".join("  room_setpoint_%s:\n    name: %s setpoint\n    min: 5\n    max: 30\n    step: 0.5\n"
                   "    unit_of_measurement: °C\n    initial: %s" % (r, NICE[r], v)
                   for r, v in zip(ROOMS, (21, 20.5, 18, 21, 22)))
    open(os.path.join(CONF, "configuration.yaml"), "w").write(CONFIGURATION % {"setpoints": sp, "forecast": FORECAST, "forecast_h": FORECAST_H})
    open(os.path.join(CONF, "ui-lovelace.yaml"), "w").write(
        "title: Demo\nviews:\n  - title: Demo\n    cards: []\n")
    shutil.copy(os.path.join(REPO, "themes", "aurora.yaml"), os.path.join(CONF, "themes", "aurora.yaml"))
    open(os.path.join(CONF, "dashboards", "aurora.yaml"), "w").write(build_dashboard())
    shutil.copy(os.path.join(REPO, "dist", "aurora-effects.js"),
                os.path.join(CONF, "www", "aurora-effects", "aurora-effects.js"))
    cards = os.path.join(HERE, "cache", "www")
    if not os.path.isdir(cards):
        sys.exit("run fetch_cards.py first")
    for c in os.listdir(cards):
        shutil.copytree(os.path.join(cards, c), os.path.join(CONF, "www", "community", c))
    cc = os.path.join(CONF, "custom_components", "aurora_demo_seed")
    json.dump(MANIFEST, open(os.path.join(cc, "manifest.json"), "w"), indent=1)
    open(os.path.join(cc, "__init__.py"), "w").write(SEED_PY)
    json.dump({"entities": list(ENT.values())}, open(os.path.join(CONF, "demo_seed.json"), "w"))
    write_lightstrips(os.path.join(CONF, "www"))
    print("entities:", len(ENT), "| history points:", sum(len(e["hist"]) for e in ENT.values()))


if __name__ == "__main__":
    main()
