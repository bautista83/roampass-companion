"""Tablero "vuelta al mundo": mapa estilizado (Europa agrandada, sin fronteras internas) con un
camino de casillas que sale de Buenos Aires y vuelve a Buenos Aires.

Estilo cartoon (ver build_worldmap_cartoon.py). Code-drawn, sin modelo de imagen.
Uso: python build_board_route.py -> board-route.svg + palette-board.json + board-route.json
"""
import json
import math
from pathlib import Path

import build_worldmap as bw
import build_worldmap_cartoon as cart

HERE = Path(__file__).parent
W, H = 1920, 1200
CARD = cart.CARD
TOTAL_MILES = 24900
TOTAL_SPACES = 60                 # casillas del recorrido (monumentos + casillas de viaje)
BADGE = 62
SPACE_R = 11

PALETTE = dict(cart.PALETTE)
PALETTE.update({
    "na": "#ffc2ad", "sa": "#a8dc9a", "eu": "#d6c8ff", "af": "#ffe38f", "as": "#a6e3cf", "oc": "#ffbfd9",
    "arg": "#ffd43b", "road": "#ffffff",
})

# grupo -> (escala, dx, dy) aplicada en pixeles alrededor del centro del grupo (lon, lat)
GROUPS = {
    "na": (1.0, -36, 0, (-100, 45)),
    "sa": (1.0, -10, 20, (-60, -15)),
    "eu": (1.65, -78, -10, (12, 50)),
    "af": (1.0, -6, 62, (20, 5)),
    "as": (1.0, 34, 0, (90, 45)),
    "oc": (1.0, 26, 30, (135, -25)),
    "nz": (1.0, -40, 20, (172, -41)),
}
GROUP_COLOR = {"na": "na", "sa": "sa", "eu": "eu", "af": "af", "as": "as", "oc": "oc", "nz": "oc"}
BADGE_COLOR = {"na": "coral", "sa": "green", "eu": "lilac", "af": "yellow", "as": "blue", "oc": "coral", "nz": "coral"}

ASIA_NAMES = {"Russia", "Turkey", "Cyprus", "N. Cyprus", "Georgia", "Armenia", "Azerbaijan", "Kazakhstan"}
AFRICA_NAMES = {"Eritrea", "Djibouti"}

def group_of(name, lon, lat):
    if name == "Iceland":
        return "na"
    if name == "New Zealand":
        return "nz"
    if name in ASIA_NAMES:
        return "as"
    if name in AFRICA_NAMES:
        return "af"
    if lon < -25:
        return "sa" if (lat < 0 or (lat < 12.5 and lon > -79.5)) else "na"
    if lat > 35 and lon < 45:
        return "eu"
    if -20 < lon < 52 and lat < 37.5 and not (lon > 34 and lat > 12):
        return "af"
    if (lon > 110 and lat < -10) or (lon > 140 and lat < 0) or lon > 160 or lon < -140:
        return "oc"
    return "as"

def base_xy(lon, lat):
    return cart.project(lon, lat)

def transform(g, x, y):
    s, dx, dy, (clon, clat) = GROUPS[g]
    cx, cy = base_xy(clon, clat)
    return cx + s * (x - cx) + dx, cy + s * (y - cy) + dy

def place(g, lon, lat):
    return transform(g, *base_xy(lon, lat))

# ---------------------------------------------------------------- tierra por grupos
def load_named():
    topo = json.loads((HERE / "data" / "countries-50m.json").read_text(encoding="utf-8"))
    names = [g.get("properties", {}).get("name", "") for g in topo["objects"]["countries"]["geometries"]
             if g.get("id") != "010"]
    return list(zip(names, bw.load_countries()))

def ring_d(ring, g, shift, max_lat):
    pts, prev = [], None
    for lon, lat in ring:
        if prev is not None:
            while lon - prev > 180:
                lon -= 360
            while lon - prev < -180:
                lon += 360
        prev = lon
        x, y = transform(g, *base_xy(lon + shift, min(lat, max_lat)))
        if not pts or abs(x - pts[-1][0]) + abs(y - pts[-1][1]) > 1.8:
            pts.append((x, y))
    if len(pts) < 3:
        return None
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    if (max(xs) - min(xs)) * (max(ys) - min(ys)) < 60:
        return None
    if max(xs) < CARD[0] or min(xs) > CARD[0] + CARD[2]:
        return None
    return "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z"

def land_paths():
    groups = {g: [] for g in GROUPS}
    argentina = []
    for name, polys in load_named():
        for poly in polys:
            ring = poly[0]
            lon = sum(p[0] for p in ring) / len(ring)
            lat = sum(p[1] for p in ring) / len(ring)
            g = group_of(name, lon, lat)
            max_lat = 74.0 if g == "eu" else 89.0
            if g == "eu" and lat > 74:
                continue
            for shift in (-360.0, 0.0, 360.0):
                parts = [d for d in (ring_d(r, g, shift, max_lat) for r in poly) if d]
                if parts and parts[0].startswith("M"):
                    groups[g].extend(parts)
                    if name == "Argentina":
                        argentina.extend(parts)
    return {g: "".join(v) for g, v in groups.items()}, "".join(argentina)

# ---------------------------------------------------------------- recorrido
NEW_ICONS = {
    "amazonas": cart.ic(cart.P("M2 29 Q12 23 20 29 Q28 35 38 29 V38 H2 Z", "blue"), cart.R(9, 16, 3, 12, "sand"),
                        cart.C(10.5, 12, 7, "green"), cart.R(26, 18, 3, 10, "sand"), cart.C(27.5, 14, 6, "green"),
                        cart.P("M17 9 Q20 5 23 8 L27 9 L23 11 Q20 13 17 9 Z", "yellow")),
    "tombuctu": cart.ic(cart.P("M4 36 V18 H9 V10 L11.5 6 L14 10 V18 H26 V10 L28.5 6 L31 10 V18 H36 V36 Z", "sand"),
                        cart.L("M4 22 H1 M9 14 H6 M26 14 H23 M36 22 H39 M14 26 H11 M31 26 H28"),
                        cart.L("M17 36 V29 Q20 25 23 29 V36")),
    "victoria": cart.ic(cart.P("M4 22 A16 16 0 0 1 36 22 H31 A11 11 0 0 0 9 22 Z", "coral"),
                        cart.P("M9 22 A11 11 0 0 1 31 22 H27 A7 7 0 0 0 13 22 Z", "yellow"),
                        cart.R(2, 24, 36, 5, "green"), cart.R(6, 29, 28, 8, "blue"), cart.L("M12 30 V36 M20 30 V36 M28 30 V36")),
    "lalibela": cart.ic(cart.R(3, 3, 34, 34, "sand", 4), cart.P("M16 6 H24 V16 H34 V24 H24 V34 H16 V24 H6 V16 H16 Z", "coral"),
                        cart.L("M16 16 L24 24 M24 16 L16 24")),
    "petra": cart.ic(cart.P("M5 37 V5 H35 V37 Z", "coral"), cart.L("M9 37 V25 M15 37 V25 M25 37 V25 M31 37 V25 M7 25 H33"),
                     cart.L("M11 21 L20 15 L29 21 M14 5 V12 H26 V5"), cart.R(17, 29, 6, 8, "ink")),
    "everest": cart.ic(cart.P("M2 36 L15 13 L21 21 L27 8 L38 36 Z", "lilac"),
                       cart.P("M27 8 L31 16 L28 15 L25 18 L23 15 Z M15 13 L18 18 L14 17 L12 19 Z", "snow"),
                       cart.L("M27 8 V1"), cart.P("M27 1.5 L34 4 L27 6.5 Z", "red")),
    "halong": cart.ic(cart.P("M3 30 Q3 13 8 10 Q14 12 13 30 Z", "green"), cart.P("M14 30 Q15 6 21 5 Q27 8 25 30 Z", "green"),
                      cart.P("M25 29 H38 L35 34 H28 Z", "coral"), cart.P("M31 28 V16 L37 25 Z", "yellow"),
                      cart.L("M2 37 Q8 35 14 37 Q20 39 26 37")),
    "borobudur": cart.ic(cart.P("M3 36 H37 V31 H3 Z", "sand"), cart.P("M6 31 V26 H34 V31 Z", "sand"),
                         cart.P("M9 26 V21 H31 V26 Z", "sand"), cart.P("M13 21 Q13 12 20 11 Q27 12 27 21 Z", "sand"),
                         cart.L("M20 11 V4 M12 33.5 H14 M20 33.5 H22 M28 33.5 H30")),
    "kiwi": cart.ic(cart.P("M6 25 Q6 13 18 13 Q28 13 30 20 Q31 31 19 32 Q6 32 6 25 Z", "sand"), cart.C(29, 17, 4.5, "sand"),
                    cart.L("M32.5 19 L39 30 M15 32 V37 M22 32 V37 M13 37 H17 M20 37 H24"), cart.C(30, 16, 0.6, "ink")),
}
ICONS = dict(cart.ICONS)
ICONS.update(NEW_ICONS)

POS = {m[0]: (m[1], m[2]) for m in bw.MONUMENTS}
POS.update({
    "amazonas": (-60.0, -3.1), "tombuctu": (-3.0, 16.8), "victoria": (25.9, -17.9), "lalibela": (39.0, 12.0),
    "petra": (35.4, 30.3), "everest": (86.9, 28.0), "halong": (107.1, 20.9), "borobudur": (110.2, -7.6),
    "kiwi": (172.5, -41.0),
})
STATION_GROUP = {
    "obelisco": "sa", "iguazu": "sa", "cristo": "sa", "amazonas": "sa", "machu": "sa", "perito": "sa", "moai": "sa",
    "chichen": "na", "golden": "na", "needle": "na", "totem": "na", "cntower": "na", "libertad": "na", "igloo": "na",
    "bigben": "eu", "eiffel": "eu", "castillo": "eu", "partenon": "eu", "coliseo": "eu", "sagrada": "eu",
    "basilio": "as", "hagia": "as", "petra": "as", "burj": "as", "taj": "as", "everest": "as", "tren": "as",
    "muralla": "as", "torii": "as", "fuji": "as", "halong": "as", "angkor": "as", "petronas": "as", "borobudur": "as",
    "camello": "af", "tombuctu": "af", "table": "af", "victoria": "af", "baobab": "af", "kilimanjaro": "af",
    "lalibela": "af", "piramides": "af",
    "uluru": "oc", "opera": "oc", "kiwi": "nz",
}
ROUTE = [
    "obelisco", "iguazu", "cristo", "amazonas", "machu", "chichen", "golden", "needle", "totem", "cntower",
    "libertad", "igloo", "bigben", "eiffel", "castillo", "basilio", "hagia", "partenon", "coliseo", "sagrada",
    "camello", "tombuctu", "table", "victoria", "baobab", "kilimanjaro", "lalibela", "piramides", "petra", "burj",
    "taj", "everest", "tren", "muralla", "torii", "fuji", "halong", "angkor", "petronas", "borobudur", "uluru",
    "opera", "kiwi", "moai", "perito",
]
WRAP_AFTER = "kiwi"               # el tramo kiwi -> moai cruza el Pacifico por el borde del tablero

def layout_stations():
    target = [place(STATION_GROUP[n], *POS[n]) for n in ROUTE]
    pos = [list(t) for t in target]
    min_d = BADGE + 12
    for _ in range(600):
        moved = False
        for i in range(len(pos)):
            for j in range(i + 1, len(pos)):
                dx, dy = pos[j][0] - pos[i][0], pos[j][1] - pos[i][1]
                if abs(dx) < min_d and abs(dy) < min_d:
                    ox, oy = min_d - abs(dx), min_d - abs(dy)
                    if ox < oy:
                        s = (1 if dx >= 0 else -1) * ox / 2
                        pos[i][0] -= s
                        pos[j][0] += s
                    else:
                        s = (1 if dy >= 0 else -1) * oy / 2
                        pos[i][1] -= s
                        pos[j][1] += s
                    moved = True
        for p, (tx, ty) in zip(pos, target):
            p[0] += (tx - p[0]) * 0.015
            p[1] += (ty - p[1]) * 0.015
            p[0] = min(max(p[0], CARD[0] + BADGE * 0.8), CARD[0] + CARD[2] - BADGE * 0.8)
            p[1] = min(max(p[1], CARD[1] + BADGE * 0.8), CARD[1] + CARD[3] - BADGE * 0.8)
        if not moved:
            break
    return target, pos

def catmull(points, wrap=None, span=0.0, samples=24):
    """Curva cerrada por los puntos; el paso wrap -> wrap+1 se desenvuelve sumando `span` en x."""
    n = len(points)
    out = []
    for i in range(n):
        a, b, c, d = ((i - 1) % n, i, (i + 1) % n, (i + 2) % n)
        p0, p1, p2, p3 = (list(points[k]) for k in (a, b, c, d))
        if a == wrap:
            p0[0] -= span
        if b == wrap:
            p2[0] += span
            p3[0] += span
        if c == wrap:
            p3[0] += span
        seg = []
        for k in range(samples):
            t = k / samples
            t2, t3 = t * t, t * t * t
            seg.append(tuple(0.5 * ((2 * p1[a]) + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2
                                    + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3) for a in (0, 1)))
        out.append(seg)
    return out

def length(seg):
    return sum(math.dist(seg[k], seg[k + 1]) for k in range(len(seg) - 1))

def point_at(seg, d):
    for k in range(len(seg) - 1):
        l = math.dist(seg[k], seg[k + 1])
        if d <= l:
            t = d / l if l else 0
            return (seg[k][0] + (seg[k + 1][0] - seg[k][0]) * t, seg[k][1] + (seg[k + 1][1] - seg[k][1]) * t)
        d -= l
    return seg[-1]

def build_track(pos):
    """Devuelve los tramos (lista de polilineas) y el tramo con cruce de borde ya partido."""
    wi = ROUTE.index(WRAP_AFTER)
    pts = [tuple(p) for p in pos]
    span = float(CARD[2])
    legs = catmull(pts, wrap=wi, span=span)
    # los tramos que arrancan despues del cruce quedan en coordenadas normales; el cruce queda en x + span
    return legs, wi, span

def allocate_spaces(legs):
    lens = [length(l) for l in legs]
    plain_total = TOTAL_SPACES - len(ROUTE)
    raw = [plain_total * l / sum(lens) for l in lens]
    counts = [int(r) for r in raw]
    for i in sorted(range(len(raw)), key=lambda i: raw[i] - counts[i], reverse=True)[:plain_total - sum(counts)]:
        counts[i] += 1
    return counts

# ---------------------------------------------------------------- composicion
def build():
    lands, argentina = land_paths()
    target, pos = layout_stations()
    legs, wi, span = build_track(pos)
    counts = allocate_spaces(legs)
    x0, y0, cw, ch = CARD
    o = [f'<rect class="c-bg" x="0" y="0" width="{W}" height="{H}"/>',
         f'<rect class="c-ink" x="{x0 + 10}" y="{y0 + 10}" width="{cw}" height="{ch}" rx="36"/>',
         f'<rect class="c-ocean" x="{x0}" y="{y0}" width="{cw}" height="{ch}" rx="36"/>',
         f'<clipPath id="card"><rect x="{x0}" y="{y0}" width="{cw}" height="{ch}" rx="36"/></clipPath>',
         '<g clip-path="url(#card)">']
    for wx, wy in ((150, 640), (300, 930), (800, 1000), (980, 420), (1260, 960), (1520, 1040), (1800, 700),
                   (110, 300), (700, 760), (1680, 880), (420, 560), (1120, 1090), (830, 210)):
        o.append(f'<path class="wv" d="M{wx} {wy} q10 -8 20 0 t20 0 t20 0"/>')
    for g in ("as", "oc", "nz", "af", "na", "sa", "eu"):
        d = lands[g]
        o.append(f'<path class="c-ink" transform="translate({cart.SHADOW} {cart.SHADOW})" d="{d}"/>')
        o.append(f'<path class="c-ink coast" d="{d}"/>')
        o.append(f'<path class="c-{GROUP_COLOR[g]} seam-{GROUP_COLOR[g]}" d="{d}"/>')
        if g == "sa":
            o.append(f'<path class="c-arg bd" d="{argentina}"/>')

    # camino: borde negro + relleno blanco (como las calles de la referencia)
    def poly_d(seg, dx=0.0):
        return "M" + "L".join(f"{x + dx:.1f} {y:.1f}" for x, y in seg)
    road = []
    for i, seg in enumerate(legs):
        road.append(poly_d(seg))
        if i == wi:
            road.append(poly_d(seg, -span))
    rd = "".join(road)
    o.append(f'<path class="road-sh" transform="translate(5 5)" d="{rd}"/>')
    o.append(f'<path class="road-out" d="{rd}"/>')
    o.append(f'<path class="road-in" d="{rd}"/>')
    o.append(f'<path class="road-dash" d="{rd}"/>')

    # casillas de viaje repartidas en cada tramo
    spaces = []
    for i, seg in enumerate(legs):
        L = length(seg)
        n = counts[i]
        for k in range(1, n + 1):
            x, y = point_at(seg, L * k / (n + 1))
            if x > x0 + cw + 10:
                x -= span
            spaces.append((x, y))
    for x, y in spaces:
        o.append(f'<circle class="c-ink" cx="{x + 3:.1f}" cy="{y + 3:.1f}" r="{SPACE_R}"/>')
        o.append(f'<circle class="st c-paper" cx="{x:.1f}" cy="{y:.1f}" r="{SPACE_R}"/>')
        o.append(f'<circle class="c-ink" cx="{x:.1f}" cy="{y:.1f}" r="3"/>')
    o.append("</g>")
    o.append(f'<rect class="frame" x="{x0}" y="{y0}" width="{cw}" height="{ch}" rx="36"/>')

    # flechas de sentido en el cruce del Pacifico
    for ax, ay, rot in ((x0 + cw - 30, None, 0), (x0 + 30, None, 0)):
        seg = legs[wi]
        pts_edge = [p for p in seg if abs((p[0] if p[0] <= x0 + cw + 10 else p[0] - span) - ax) < 30]
        if pts_edge:
            py = pts_edge[0][1]
            o.append(f'<g transform="translate({ax} {py:.1f})"><path class="st c-yellow" d="M-12 -12 L6 0 L-12 12 Z"/></g>')

    # estaciones (monumentos)
    half = BADGE / 2
    for k, (name, (bx, by)) in enumerate(zip(ROUTE, pos)):
        g = STATION_GROUP[name]
        size = BADGE + 18 if k == 0 else BADGE
        hs = size / 2
        rot = (-4, 3, -2, 4, -3, 2)[k % 6]
        colr = "yellow" if k == 0 else BADGE_COLOR[g]
        o.append(f'<g transform="translate({bx:.1f} {by:.1f}) rotate({rot})">')
        o.append(f'<rect class="c-ink" x="{-hs + 5}" y="{-hs + 5}" width="{size}" height="{size}" rx="14"/>')
        o.append(f'<rect class="st c-{colr}" x="{-hs}" y="{-hs}" width="{size}" height="{size}" rx="14"/>')
        sc = 1.2 * size / BADGE
        o.append(f'<g transform="scale({sc:.3f}) translate(-20 -20)">{ICONS[name]}</g></g>')
    # bandera de salida a cuadros junto al Obelisco
    fx, fy = pos[0][0] - 64, pos[0][1] - 30
    o.append(f'<path class="ln" d="M{fx} {fy + 44} V{fy}"/>')
    flag = [f'<rect class="st c-paper" x="{fx}" y="{fy}" width="30" height="20"/>']
    for r in range(2):
        for c in range(3):
            if (r + c) % 2 == 0:
                flag.append(f'<rect class="c-ink" x="{fx + c * 10}" y="{fy + r * 10}" width="10" height="10"/>')
    o.extend(flag)

    style = ("".join(f".c-{n}{{fill:{PALETTE[n]}}}" for n in PALETTE) + ".c-none{fill:none}"
             + "".join(f".seam-{n}{{stroke:{PALETTE[n]};stroke-width:1.6;stroke-linejoin:round}}" for n in set(GROUP_COLOR.values()))
             + ".st{stroke:#111111;stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}"
             + ".ln{fill:none;stroke:#111111;stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}"
             + ".bd{stroke:#111111;stroke-width:2;stroke-linejoin:round}"
             + ".coast{stroke:#111111;stroke-width:6;stroke-linejoin:round}"
             + ".wv{fill:none;stroke:#a9d8fa;stroke-width:4;stroke-linecap:round}"
             + ".road-sh{fill:none;stroke:#111111;stroke-width:18;stroke-linecap:round;stroke-linejoin:round}"
             + ".road-out{fill:none;stroke:#111111;stroke-width:18;stroke-linecap:round;stroke-linejoin:round}"
             + ".road-in{fill:none;stroke:#ffffff;stroke-width:11;stroke-linecap:round;stroke-linejoin:round}"
             + ".road-dash{fill:none;stroke:#111111;stroke-width:2;stroke-dasharray:6 8;stroke-linecap:round}"
             + ".frame{fill:none;stroke:#111111;stroke-width:6}")
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
           f'data-codeart="worldmap-route"><style>{style}</style>' + "".join(o) + "</svg>")
    (HERE / "board-route.svg").write_text(svg, encoding="utf-8")
    (HERE / "palette-board.json").write_text(json.dumps({"colors": PALETTE}, indent=1), encoding="utf-8")

    # datos del recorrido: casilla -> millas acumuladas (cada casilla = TOTAL_MILES / TOTAL_SPACES)
    per = TOTAL_MILES / TOTAL_SPACES
    seq, idx = [], 0
    for i, name in enumerate(ROUTE):
        seq.append({"space": idx, "type": "monument", "id": name, "miles": round(idx * per)})
        idx += 1
        for _ in range(counts[i]):
            seq.append({"space": idx, "type": "travel", "miles": round(idx * per)})
            idx += 1
    (HERE / "board-route.json").write_text(json.dumps({"total_miles": TOTAL_MILES, "spaces": idx,
                                                       "miles_per_space": round(per, 1), "track": seq}, indent=1),
                                           encoding="utf-8")
    print(json.dumps({"svg": str(HERE / "board-route.svg"), "kb": round(len(svg) / 1024), "stations": len(ROUTE),
                      "spaces": idx, "miles_per_space": round(per, 1)}))

if __name__ == "__main__":
    build()
