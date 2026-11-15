"""Genera el tablero mapa mundi synthwave/pixel (SVG portable, code-drawn, sin modelo de imagen).

Fronteras: Natural Earth 1:50m (dominio publico) via world-atlas@2.0.2 (topojson).
Uso: python build_worldmap.py  -> escribe worldmap.svg y palette.json junto a este script.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).parent
W, H = 1920, 1200
CELL = 4                      # tamano del "pixel" de tierra
GW, GH = W // CELL, H // CELL
MAP_TOP = 120                 # y donde empieza lat 84 (mapa centrado en vertical)
LAT_N, LAT_S = 84.0, -58.0
SPR = 4                       # tamano del pixel de los monumentos

PALETTE = {
    "ocean": "#1a0630", "glow": "#2c0a4c", "extrude": "#ff2bd6",
    "border": "#240640", "dot": "#ff3fd0", "dot2": "#b0209c", "star": "#ffd6f5",
    "l0": "#6a2bc2", "l1": "#b02ab8", "l2": "#e2569e", "l3": "#4b3bd1", "l4": "#8f3fb0",
    "h0": "#9a63ff", "h1": "#e45ae6", "h2": "#ff9ccf", "h3": "#7f7bff", "h4": "#c77ae0",
    "K": "#14031f", "W": "#fff4fb", "P": "#ff7ad9", "M": "#ff2bd6", "Y": "#ffd23f",
    "O": "#ff8a3d", "R": "#ff3864", "C": "#3ef2ff", "B": "#4f6bff", "V": "#b3a6e0",
    "D": "#3a0d5c", "G": "#2de2a6", "g": "#16a37f", "S": "#ffc27a", "s": "#d98a52",
    "c1": "#ffb0e6", "c2": "#c46bff", "c3": "#6f7dff", "pin": "#3ef2ff",
}

# ---------------------------------------------------------------- proyeccion (Miller)
def miller(lat):
    return 1.25 * math.log(math.tan(math.pi / 4 + 0.4 * math.radians(lat)))

KX = GW / (2 * math.pi)                       # celdas por radian
Y0 = miller(LAT_N)
MAP_CELLS_H = (Y0 - miller(LAT_S)) * KX

def project(lon, lat):
    """lon/lat -> pixeles del lienzo."""
    lat = max(min(lat, 89.0), -89.0)
    x = (lon + 180.0) / 360.0 * W
    y = MAP_TOP + (Y0 - miller(lat)) * KX * CELL
    return x, y

# ---------------------------------------------------------------- topojson
def load_countries():
    topo = json.loads((HERE / "data" / "countries-50m.json").read_text(encoding="utf-8"))
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def ring(idx):
        out = []
        for i in idx:
            pts = arcs[i] if i >= 0 else arcs[~i][::-1]
            out.extend(pts if not out else pts[1:])
        return out

    countries = []
    for g in topo["objects"]["countries"]["geometries"]:
        if g.get("id") == "010":          # Antartida fuera del tablero
            continue
        polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]] if g["type"] == "Polygon" else []
        countries.append([[ring(r) for r in poly] for poly in polys])
    return countries

def rasterize(countries):
    img = Image.new("I", (GW, GH), 0)
    d = ImageDraw.Draw(img)

    def unwrap(r):
        out, prev = [], None
        for lon, lat in r:
            if prev is not None:
                while lon - prev > 180:
                    lon -= 360
                while lon - prev < -180:
                    lon += 360
            out.append((lon, lat))
            prev = lon
        return out

    def cells(r, shift=0.0):
        return [(project(lon + shift, lat)[0] / CELL, project(lon + shift, lat)[1] / CELL) for lon, lat in r]

    def fill(r, value):
        u = unwrap(r)
        for shift in (-360.0, 0.0, 360.0):
            d.polygon(cells(u, shift), fill=value, outline=value or None)

    def area(c):
        a = 0
        for poly in c:
            xs = np.array(poly[0])
            a += abs(np.dot(xs[:, 0], np.roll(xs[:, 1], 1)) - np.dot(xs[:, 1], np.roll(xs[:, 0], 1)))
        return a

    order = sorted(range(len(countries)), key=lambda i: -area(countries[i]))
    for i in order:
        for poly in countries[i]:
            if len(poly[0]) > 2:
                fill(poly[0], i + 1)
            for hole in poly[1:]:
                if len(hole) > 2:
                    fill(hole, 0)
    return np.array(img, dtype=np.int32)

def color_countries(grid):
    adj = {}
    for a, b in ((grid[:, :-1], grid[:, 1:]), (grid[:-1, :], grid[1:, :])):
        m = (a != b) & (a > 0) & (b > 0)
        for u, v in set(zip(a[m].tolist(), b[m].tolist())):
            adj.setdefault(u, set()).add(v)
            adj.setdefault(v, set()).add(u)
    ids = sorted(set(np.unique(grid).tolist()) - {0}, key=lambda i: -len(adj.get(i, ())))
    col = {}
    for i in ids:
        used = {col[n] for n in adj.get(i, ()) if n in col}
        col[i] = next(k for k in (i % 5, 0, 1, 2, 3, 4) if k not in used) if len(used) < 5 else i % 5
    return col

# ---------------------------------------------------------------- salida SVG
out = []

def rect(cls, x, y, w, h):
    out.append(f'<rect class="c-{cls}" x="{x}" y="{y}" width="{w}" height="{h}"/>')

def emit_grid(cg, x0=0, y0=0, s=CELL):
    """cg: matriz de nombres de color (None = vacio). Fusiona corridas por fila."""
    for r, row in enumerate(cg):
        c = 0
        n = len(row)
        while c < n:
            v = row[c]
            if v is None:
                c += 1
                continue
            e = c
            while e + 1 < n and row[e + 1] == v:
                e += 1
            rect(v, x0 + c * s, y0 + r * s, (e - c + 1) * s, s)
            c = e + 1

def sprite(rows, cx, by, s=SPR, outline=True):
    """Dibuja un sprite ASCII con base centrada en (cx, by). '.' = vacio."""
    h, w = len(rows), max(len(r) for r in rows)
    m = [[(ch if ch not in ". " else None) for ch in r.ljust(w, ".")] for r in rows]
    if outline:
        o = [[None] * (w + 2) for _ in range(h + 2)]
        for r in range(h):
            for c in range(w):
                if m[r][c]:
                    for dr in (-1, 0, 1):
                        for dc in (-1, 0, 1):
                            o[r + 1 + dr][c + 1 + dc] = "K"
        for r in range(h):
            for c in range(w):
                if m[r][c]:
                    o[r + 1][c + 1] = m[r][c]
        m, h, w = o, h + 2, w + 2
    x0 = int(round(cx - w * s / 2))
    y0 = int(round(by - h * s))
    emit_grid(m, x0, y0, s)

# ---------------------------------------------------------------- sprites de monumentos
def gen_coliseo():
    rows = ["...SSSSSSSSSSSSSSSSSSSS......", "..SSSSSSSSSSSSSSSSSSSSSSS.S..",
            ".SDSDSDSDSDSDSDSDSDSDSDSDSS..", ".SDSDSDSDSDSDSDSDSDSDSDSDSDS."]
    rows += ["SSSSSSSSSSSSSSSSSSSSSSSSSSSSS"]
    rows += ["SDDsDDsDDsDDsDDsDDsDDsDDsDDsS", "SDDsDDsDDsDDsDDsDDsDDsDDsDDsS", "SSSSSSSSSSSSSSSSSSSSSSSSSSSSS"]
    rows += ["SDDsDDsDDsDDsDDsDDsDDsDDsDDsS", "SDDsDDsDDsDDsDDsDDsDDsDDsDDsS", "sssssssssssssssssssssssssssss"]
    return rows

def gen_chichen():
    rows = ["........SSSSS........", "........SDDDS........", "........SDDDS........"]
    for i in range(6):
        w = 9 + 2 * i
        pad = (21 - w) // 2 if w <= 21 else 0
        side = (w - 3) // 2
        rows.append("." * pad + "S" * side + "YYY" + "S" * side + "." * pad)
        rows.append("." * pad + "s" * side + "YOY" + "s" * side + "." * pad)
    rows.append("sssssssssYOYsssssssss")
    return [r[:21].ljust(21, ".") for r in rows]

def gen_pyramids():
    w, h = 30, 12
    m = [["." for _ in range(w)] for _ in range(h)]
    for (cx, ph) in ((9, 11), (19, 9), (26, 5)):
        for r in range(ph):
            y = h - ph + r
            for c in range(cx - r, cx + r + 1):
                if 0 <= c < w:
                    m[y][c] = "S" if c < cx else "s"
    return ["".join(r) for r in m]

def gen_golden_gate():
    w, h = 36, 16
    m = [["." for _ in range(w)] for _ in range(h)]
    towers = (8, 27)
    deck = 11
    for t in towers:
        for r in range(0, h - 1):
            m[r][t] = m[r][t + 1] = "R"
        for r in (1, 5, 9):
            m[r][t - 1] = m[r][t + 2] = "R"
    for c in range(w):
        m[deck][c] = "R"
        m[deck + 1][c] = "D" if c % 2 else "R"
    def cable(a, b, sag, extend=None):
        for c in range(a, b + 1):
            t = (c - a) / max(b - a, 1)
            y = int(round(1 + sag * 4 * t * (1 - t) * 1.0))
            if 0 <= y < deck:
                m[y][c] = "O"
                if c % 2 == 0:
                    for yy in range(y + 1, deck):
                        m[yy][c] = "s" if m[yy][c] == "." else m[yy][c]
    cable(towers[0] + 2, towers[1] - 1, 9)
    for c in range(0, towers[0]):
        y = int(round(1 + (towers[0] - c) / towers[0] * 9))
        if y < deck:
            m[y][c] = "O"
    for c in range(towers[1] + 2, w):
        y = int(round(1 + (c - towers[1] - 2) / (w - towers[1] - 2) * 9))
        if y < deck:
            m[y][c] = "O"
    for c in range(w):
        m[h - 2][c] = "C" if c % 3 else "."
        m[h - 1][c] = "." if c % 3 else "C"
    return ["".join(r) for r in m]

def gen_fuji():
    w, h = 28, 13
    m = [["." for _ in range(w)] for _ in range(h)]
    for r in range(h):
        half = 3 + int(r * 1.05)
        for c in range(14 - half, 14 + half):
            if 0 <= c < w:
                snow = r < 4 or (r < 6 and (c * 7 + r) % 3 == 0)
                m[r][c] = "W" if snow else ("B" if c < 14 else "V")
    # sol rojo detras
    return ["".join(r) for r in m]

def gen_burj():
    rows = []
    widths = [1, 1, 1, 1, 3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 5, 7, 7, 7, 7, 7, 7, 9, 9, 9, 9, 9, 9, 11, 11]
    for i, wd in enumerate(widths):
        pad = (11 - wd) // 2
        body = "".join("C" if j < wd // 2 + 1 else "B" for j in range(wd))
        if wd >= 5 and i % 3 == 0:
            body = body[0] + "W" + body[2:]
        rows.append("." * pad + body + "." * pad)
    return rows

def gen_great_wall():
    w, h = 34, 14
    m = [["." for _ in range(w)] for _ in range(h)]
    for c in range(w):
        y = int(round(6 + 3 * math.sin(c / 34 * 2 * math.pi * 1.2)))
        for r in range(y + 3, h):
            m[r][c] = "g"
        for r in range(y, y + 3):
            m[r][c] = "S" if r == y else "s"
        if c % 2 == 0:
            m[y - 1][c] = "S"
    for tc in (5, 17, 29):
        y = int(round(6 + 3 * math.sin(tc / 34 * 2 * math.pi * 1.2)))
        for r in range(y - 4, y + 1):
            for c in range(tc - 2, tc + 3):
                m[r][c] = "S" if c < tc + 1 else "s"
        m[y - 2][tc] = "D"
        for c in (tc - 2, tc, tc + 2):
            m[y - 5][c] = "S"
    return ["".join(r) for r in m]

SPRITES = {
    "eiffel": ["......Y......", "......P......", ".....PPP.....", ".....PMP.....", ".....PMP.....",
               ".....PMP.....", "....PPPPP....", "....PM.MP....", "....PM.MP....", "....PM.MP....",
               "...PPPPPPP...", "...PM...MP...", "...PM...MP...", "..PM.....MP..", "..PPPPPPPPP..",
               "..PM.....MP..", ".PM.......MP.", ".PM..PPP..MP.", "PM..P...P..MP", "PM.P.....P.MP",
               "PPP.......PPP"],
    "bigben": ["....Y....", "....S....", "...SSS...", "...SOS...", "..SSSSS..", "..SOSOS..",
               ".SSSSSSS.", ".SWWWWWS.", ".SWWDWWS.", ".SWWDDWS.", ".SWWWWWS.", ".SSSSSSS.",
               ".SOSSSOS.", ".SOSSSOS.", ".SSSSSSS.", ".SOSSSOS.", ".SOSSSOS.", ".SSSSSSS.",
               ".SOSSSOS.", ".SOSSSOS.", ".SSSSSSS.", "SSSSSSSSS", "sssssssss"],
    "obelisco": ["...W...", "..WWP..", "..WWP..", "..WDP..", "..WWP..", "..WWP..", "..WWP..",
                 "..WWP..", ".WWWPP.", ".WWWPP.", ".WWWPP.", ".WWWPP.", ".WWWPP.", ".WWWPP.",
                 ".WWWPP.", ".WWWPP.", ".WWDPP.", ".WWDPP.", "PPPPPPP", "PPPPPPP"],
    "cristo": ["..........WW.........", "..........WW.........", "...WWWWWWWWWWWWWWWW..",
               "...PPPPPPWWWWPPPPPP..", ".........WWWP........", ".........WWWP........",
               ".........WWWP........", ".........WWWP........", "........WWWWPP.......",
               "........WWWWPP.......", ".........PPPP........", "........VVVVVV.......",
               "......GGGGGGGGGG.....", "....GGGgGGGGGGGGGG...", "..GGGGGGGGGGgGGGGGGG.",
               "GGGgGGGGGGGGGGGGGGgGG"],
    "machu": ["...............GG.........", "..............GGgG........", ".............GGGGgG.......",
              "............GGgGGGGG......", "...........GGGGGGgGGG.....", "..........GGGgGGGGGGGG....",
              ".....GG..GGGGGGGGGGgGGG...", "....GGGGGGGGGgGGGGGGGGGG..", "...SSWSSWSSGGGGGGGGGGGGGG.",
              "...SDSSDSSSGGGGGgGGGGGGGGG", "..GGGGGGGGGGGGGGGGGGGGGGGG", "..GgGgGgGgGgGgGgGgGgGgGgGg",
              ".GGGGGGGGGGGGGGGGGGGGGGGGG", ".gGgGgGgGgGgGgGgGgGgGgGgGg", "GGGGGGGGGGGGGGGGGGGGGGGGGG"],
    "libertad": [".......Y...", "......YOY..", ".......G...", ".......G...", "..G.G.GG...",
                 "...GGGGG...", "..GGGGG....", "...GGG.....", "..GGGGG....", "..GGgGG....",
                 ".SGGgGGG...", ".SGGgGG....", ".SGGGgG....", "..GGGgG....", "..GGGGGG...",
                 "..GgGGgG...", "..GGGGGG...", ".PPPPPPPP..", ".PDPDPDPP..", "..PPPPPP...",
                 "..PDPPDP...", ".PPPPPPPP..", "PPPPPPPPPP."],
    "taj": ["...........Y...........", "..........WWW..........", ".........WWWWW.........",
            "........WWWWWWP........", ".Y......WWWWWWP......Y.", ".W.......WWWWP.......W.",
            "WWW...WWWWWWWWWWW...WWW", ".W....W.WWWWWWW.W....W.", ".W....WWWWDDDWWWW....W.",
            ".W....WDWWDDDWWDW....W.", ".W....WWWWDDDWWWW....W.", ".W..WWWWWWDDDWWWWWW..W.",
            ".W..WDWWWWDDDWWWWDW..W.", ".W..WWWWWWWWWWWWWWW..W.", "PPPPPPPPPPPPPPPPPPPPPPP"],
    "opera": ["........W...............", ".......WW......W........", "......WWW.....WW........",
              ".....WWWW....WWW...W....", "....WWWWW...WWWW..WW....", "...WWWWPW..WWWWW.WWW....",
              "..WWWWPPW.WWWWPWWWWW....", ".WWWWPPPWWWWWPPWWWPW....", "SSSSSSSSSSSSSSSSSSSSSSSS",
              "SDSDSDSDSDSDSDSDSDSDSDSD", "CC.CC.CC.CC.CC.CC.CC.CC."],
    "basilio": ["........Y........", "........Y........", ".......RRR.......", "......RYRYR......",
                "......RRRRR......", ".......RRR.......", "..C.....W.....G..", ".CCC....W....GGG.",
                "CBCBC...W...GYGYG", "CCCCC..WWW..GGGGG", ".CCC..WWWWW..GGG.", "..W...WRWRW...W..",
                ".WWW..WWWWW..WWW.", ".WDW..WDWDW..WDW.", ".WWWWWWWWWWWWWWW.", ".WDWWDWWDWWDWWDW.",
                ".WWWWWWWWWWWWWWW.", "RRRRRRRRRRRRRRRRR"],
    "moai": ["..VVVV...", ".VVVVVV..", ".VDDDVV..", ".VVVVVV..", "..VVVVVV.", "..VDVVVV.",
             "..VVVVV..", "..VVVVV..", "..VDDVV..", "..VVVVV..", ".VVVVVVV.", ".VVVVVVV.",
             "VVVVVVVVV"],
    "angkor": ["............O............", "...........SOS...........", "....O......SSS......O....",
               "...SOS....SSSSS....SOS...", "...SSS....SDSDS....SSS...", "..SSSSS..SSSSSSS..SSSSS..",
               "..SDSDS..SDSDSDS..SDSDS..", ".SSSSSSSSSSSSSSSSSSSSSSS.", ".SDSDSDSDSDSDSDSDSDSDSDS.",
               "SSSSSSSSSSSSSSSSSSSSSSSSS"],
    "partenon": [".........W.........", ".......WWWWW.......", "....WWWWWWWWWWW....",
                 ".WWWWWWWWWWWWWWWWW.", "WWWWWWWWWWWWWWWWWWW", ".W.P.W.P.W.P.W.P.W.",
                 ".W.P.W.P.W.P.W.P.W.", ".W.P.W.P.W.P.W.P.W.", ".W.P.W.P.W.P.W.P.W.",
                 "WWWWWWWWWWWWWWWWWWW", "PPPPPPPPPPPPPPPPPPP"],
    "uluru": ["......OOOOOOOOO.......", "...OOOOOOOOOOOOOOO....", ".OOOOsOOOOOOsOOOOOOO..",
              "OOOOOsOOOOOOOsOOOOOOOO", "RRRRRRRRRRRRRRRRRRRRRR"],
    "coliseo": gen_coliseo(), "chichen": gen_chichen(), "piramides": gen_pyramids(),
    "golden": gen_golden_gate(), "fuji": gen_fuji(), "burj": gen_burj(), "muralla": gen_great_wall(),
}

# (sprite, lon, lat, dx, dy)  dx/dy desplazan el sprite y dejan un pin en el lugar real
MONUMENTS_OLD = [
    ("golden", -122.4, 37.8, -30, 10), ("libertad", -74.0, 40.7, 24, 18), ("chichen", -88.6, 20.7, 0, 6),
    ("machu", -72.5, -13.2, -40, 6), ("cristo", -43.2, -22.9, 34, 14), ("obelisco", -58.4, -34.6, 18, 16),
    ("moai", -109.4, -27.1, 0, 0), ("bigben", -0.1, 51.5, -60, 18), ("eiffel", 2.35, 48.86, -6, 8),
    ("coliseo", 12.5, 41.9, 0, 30), ("partenon", 23.7, 38.0, 40, 40), ("basilio", 37.6, 55.75, 10, 8),
    ("piramides", 31.1, 30.0, 4, 30), ("burj", 55.3, 25.2, 10, 18), ("taj", 78.0, 27.2, 0, 26),
    ("muralla", 116.5, 40.4, -10, 14), ("fuji", 138.7, 35.4, 40, 40), ("angkor", 103.9, 13.4, 0, 22),
    ("opera", 151.2, -33.9, 34, 34), ("uluru", 131.0, -25.3, 0, 6),
]

MONUMENTS = [
    ("golden", -122.4, 37.8, -40, 14), ("libertad", -74.0, 40.7, 40, 30), ("chichen", -88.6, 20.7, 0, 8),
    ("machu", -72.5, -13.2, -50, 10), ("cristo", -43.2, -22.9, 50, 20), ("obelisco", -58.4, -34.6, 30, 30),
    ("moai", -109.4, -27.1, 0, 0), ("bigben", -0.1, 51.5, -80, 30), ("eiffel", 2.35, 48.86, -14, 30),
    ("coliseo", 12.5, 41.9, 10, 44), ("partenon", 23.7, 38.0, 60, -4), ("basilio", 37.6, 55.75, 10, 8),
    ("piramides", 31.1, 30.0, -6, 56), ("burj", 55.3, 25.2, 14, 40), ("taj", 78.0, 27.2, 0, 34),
    ("muralla", 116.5, 40.4, -16, 14), ("fuji", 138.7, 35.4, 56, 50), ("angkor", 103.9, 13.4, -60, 26),
    ("opera", 151.2, -33.9, 50, 50), ("uluru", 131.0, -25.3, 0, 8),
]

def gen_sagrada():
    w, h = 19, 28
    m = [["." for _ in range(w)] for _ in range(h)]
    for x, top in ((1, 9), (5, 3), (11, 3), (15, 9)):
        m[top - 1][x + 1] = "Y"
        for r in range(top, h):
            for c in range(x, x + 3):
                m[r][c] = "S" if c < x + 2 else "s"
            if (r - top) % 3 == 1:
                m[r][x + 1] = "D"
    m[0][9] = "Y"
    for r in range(1, h):
        m[r][9] = "W" if r < 6 else m[r][9]
    for r in range(18, h):
        for c in range(w):
            m[r][c] = "S" if c < 12 else "s"
    for r in range(21, h):
        for c in (8, 9, 10):
            m[r][c] = "D"
    for c in (2, 5, 13, 16):
        m[20][c] = m[21][c] = "D"
    return ["".join(r) for r in m]

def gen_kilimanjaro():
    w, h = 32, 12
    m = [["." for _ in range(w)] for _ in range(h)]
    for r in range(h):
        half = 5 + int(r * 1.0)
        for c in range(16 - half, 16 + half):
            if 0 <= c < w:
                snow = r < 2 or (r < 4 and (c * 5 + r) % 3 == 0)
                m[r][c] = "W" if snow else ("O" if c < 16 else "s")
    return ["".join(r) for r in m]

def gen_petronas():
    w, h = 15, 32
    m = [["." for _ in range(w)] for _ in range(h)]
    for x0 in (0, 10):
        cx = x0 + 2
        for r in range(0, 4):
            m[r][cx] = "W"
        for r in range(4, 7):
            for c in range(cx - 1, cx + 2):
                m[r][c] = "C"
        for r in range(7, h):
            for c in range(x0, x0 + 5):
                m[r][c] = "C" if c < cx + 1 else "B"
            if r % 3 == 0:
                for c in range(x0, x0 + 5):
                    m[r][c] = "W"
    for c in range(5, 10):
        m[15][c] = m[16][c] = "W"
    m[17][6] = m[17][8] = "W"
    return ["".join(r) for r in m]

NEW_SPRITES = {
    "sagrada": gen_sagrada(), "kilimanjaro": gen_kilimanjaro(), "petronas": gen_petronas(),
    "hagia": ["..........Y..........", ".W........P........W.", ".W.......PPP.......W.",
              ".W.....PPPPPPM.....W.", "WWW...PPPPPPPMM...WWW", ".W...SSSSSSSSSSS...W.",
              ".W..PPPSSSSSSSMMM..W.", ".W.SSSSSSSSSSSSSSs.W.", ".W.SDSDSSDDDSSDSDs.W.",
              ".W.SSSSSSDDDSSSSSs.W.", "SSSSSSSSSSSSSSSSSSSSs"],
    "table": ["....WWWWWWWWWWWWWWWWW.....", "...BBBBBBBBBBBBBBBBBBB....", "..BBBBBVBBBBBBBBVBBBBBB...",
              ".BBBVBBBBBBBVBBBBBBBBBBB..", "BBBBBBBBBBBBBBBBBBBBBBBBBB"],
    "baobab": ["..g.G.G.g..", ".GGGGGGGGG.", "GGgGGGGgGGG", ".G.s.s.s.G.", "....sss....", "....sOs....",
               "....sOs....", "...sOOss...", "...sOOOs...", "...sOOOs...", "..ssOOOss..", "..sOOOOOs.."],
    "torii": ["DRRRRRRRRRRRRRD", ".RRRRRRRRRRRRR.", "...R.......R...", ".RRRRRRRRRRRRR.", "...R.......R...",
              "...R.......R...", "...R.......R...", "...R.......R...", "..DDD.....DDD..",
              "CC.CC.CC.CC.CC.", ".CC.CC.CC.CC.CC"],
    "cntower": ["....W....", "....W....", "....W....", "....P....", "....W....", "...WWW...", "..WDDDW..",
                ".WWWWWWW.", "..PPPPP..", "...WWW...", "...WWP...", "...WWP...", "...WWP...", "...WWP...",
                "...WWP...", "...WWP...", "...WWP...", "...WWP...", "...WWP...", "..WWWPP..", "..WWWPP..",
                ".WWWWWPP.", "WWWWWWWPP"],
    "needle": ["......Y......", "......W......", "......W......", ".....WWW.....", "...CCCCCCC...",
               "WWWWWWWWWWWWW", ".PPPPPPPPPPP.", "....WWWWW....", ".....WPW.....", ".....WPW.....",
               ".....WPW.....", ".....WPW.....", ".....WPW.....", "....WW.WW....", "....WW.WW....",
               "...WW...WW...", "...WW...WW...", "..WW.....WW..", "..PPPPPPPPP.."],
    "iguazu": ["GGgGGGGGgGGGGGGgGGGGGGGG", "GGGGGGGGGGGGGGGGGGGGGGGG", "gWCWCgWCWCgWCWCWgWCWCWgG",
               ".WCWC.WCWC.WCWCW.WCWCW..", ".WCWC.WCWC.WCWCW.WCWCW..", ".CWCW.CWCW.CWCWC.CWCWC..",
               ".WCWC.WCWC.WCWCW.WCWCW..", "WWWWWWWWWWWWWWWWWWWWWWWW", "CCCCBCCCCCBCCCCBCCCCCBCC"],
    "perito": ["..W..W...W...W..W...W...", ".WWWWWW.WWWW.WWWWWWWWW..", "WWCWWWCWWWCWWWWCWWWCWWWW",
               "WCWWCWWCWWWCWWCWWCWWWCWW", "CCWCCWCCWCCWCCWCCWCCWCCW", "CCCCCCCCCCCCCCCCCCCCCCCC",
               "BBBBCBBBBBCBBBBBCBBBBBBB"],
    "igloo": ["....WWWWWW....", "..WWCWWWCWWW..", ".WWWWWWWWWWWW.", ".WCWWWCWWWCWW.", "WWWWWWDDWWWWWW",
              "WCWWWDDDDWWWCW", "WWWWWDDDDWWWWW", "CCCCCCCCCCCCCC"],
    "totem": ["YY.....YY", "YYYRRRYYY", "...RRR...", "...WRW...", "...RRR...", "...YDY...", "...CCC...",
              "...DCD...", "...CCC...", "...WCW...", "..GGGGG..", "...DGD...", "...GGG...", "...RGR...",
              "...RRR...", "...DRD...", "...RRR...", "...YRY...", "...sss..."],
    "tren": [".DD...........................", ".DD...........................", "CCCCCCCC.MMMMMMMMM.MMMMMMMMM..",
             "CWWCWWCC.MWWMWWMWM.MWWMWWMWM..", "CCCCCCCCCMMMMMMMMMMMMMMMMMMMM.", "CCCCCCCCC.MMMMMMMMM.MMMMMMMMM.",
             ".DD..DD....DD..DD....DD..DD...", "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSS", ".s..s..s..s..s..s..s..s..s..s."],
    "camello": [".........SS...", "........SSSS..", "........SS....", "....SS..SS....", "...SSSS.SS....",
                "..SSSSSSSS....", ".SSSSSSSSS....", ".S.SSSSSS.....", "...S.S..S.S...", "...S.S..S.S...",
                "...s.s..s.s..."],
    "castillo": ["........B........", ".......BBB.......", ".......BBB.......", "..B....WWW.......",
                 ".BBB...WDW...B...", ".BBB...WWW..BBB..", ".WWW..WWWWW.BBB..", ".WDW..WDWDW.WWW..",
                 ".WWW..WWWWW.WDW..", ".WWWWWWWWWWWWWW..", ".WDWWDWWDWWDWWW..", ".WWWWWWWWWWWWWW..",
                 "GGGGGGGGGGGGGGGG."],
}
SPRITES.update(NEW_SPRITES)

MONUMENTS += [
    ("sagrada", 2.17, 41.39, -95, 85), ("castillo", 10.7, 47.6, 40, -110), ("hagia", 29.0, 41.0, 34, -36),
    ("kilimanjaro", 37.35, -3.07, 0, 10), ("table", 18.4, -33.9, -20, 30), ("baobab", 46.9, -18.9, 30, 10),
    ("petronas", 101.7, 3.15, 40, 20), ("torii", 132.3, 34.3, 10, -70), ("cntower", -79.4, 43.6, -30, -30),
    ("needle", -122.3, 47.6, -60, -40), ("iguazu", -54.4, -25.7, -60, 0), ("perito", -73.0, -50.5, 10, 10),
    ("igloo", -40.0, 72.0, 0, 0), ("totem", -150.0, 63.0, 0, 10), ("tren", 95.0, 60.0, 0, 0),
    ("camello", 2.0, 24.0, 0, 0),
]

def sprite_box(name, lon, lat, dx, dy):
    rows = SPRITES[name]
    w, h = (max(len(r) for r in rows) + 2) * SPR, (len(rows) + 2) * SPR
    x, y = project(lon, lat)
    cx, by = int(x) // 2 * 2 + dx, int(y) // 2 * 2 + dy
    return cx - w / 2, by - h, cx + w / 2, by

def overlaps():
    boxes = [(m[0], sprite_box(*m)) for m in MONUMENTS]
    res = []
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i][1], boxes[j][1]
            if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                res.append((boxes[i][0], boxes[j][0]))
    return res


def cloud(cx, by, s=4, wide=1.0):
    base = ["........111.........", "......1111111...11..", "...111222111111112..",
            ".1112222221111122221", "33332222333322223333", ".333333333333333333."]
    rows = [r.replace("1", "Y").replace("2", "P").replace("3", "B") for r in base]
    rows = [r.replace("Y", "W") for r in rows]
    m = [[{"W": "c1", "P": "c2", "B": "c3"}.get(ch) for ch in r] for r in rows]
    w = len(rows[0])
    emit_grid(m, int(cx - w * s / 2), int(by - len(rows) * s), s)

# ---------------------------------------------------------------- composicion
def build():
    countries = load_countries()
    grid = rasterize(countries)
    col = color_countries(grid)
    land = grid > 0
    horizon = int(MAP_TOP + MAP_CELLS_H * CELL)

    rect("ocean", 0, 0, W, H)

    # halftone: puntos que se achican hacia el centro desde los bordes de arriba y abajo
    rng = np.random.default_rng(83)
    for y in range(6, H - 4, 12):
        d = min(y, H - 4 - y)
        size = 4 if d < 140 else 3 if d < 250 else 2 if d < 360 else 0
        if size:
            cls = "dot" if d < 250 else "dot2"
            for x in range(6 + (y // 12 % 2) * 6, W, 12):
                rect(cls, x, y, size, size)
    for _ in range(160):
        x, y = int(rng.integers(0, W // 2)) * 2, int(rng.integers(0, H // 2)) * 2
        rect("star", x, y, 2, 2)

    # tierra: halo, extrusion magenta abajo-derecha, relleno por pais y luz superior
    pad = np.pad(land, 2)
    near = np.zeros_like(land)
    for dr in range(-2, 3):
        for dc in range(-2, 3):
            near |= pad[2 + dr:2 + dr + GH, 2 + dc:2 + dc + GW]
    ext = np.zeros_like(land)
    for dr, dc in ((1, 0), (1, 1), (0, 1), (2, 1), (2, 2), (1, 2)):
        ext |= pad[2 - dr:2 - dr + GH, 2 - dc:2 - dc + GW]
    cg = [[None] * GW for _ in range(GH)]
    up = np.vstack([np.zeros((1, GW), bool), land[:-1]])
    left = np.hstack([np.zeros((GH, 1), bool), land[:, :-1]])
    for r in range(GH):
        for c in range(GW):
            if land[r, c]:
                k = col[grid[r, c]]
                cg[r][c] = f"h{k}" if (not up[r, c] or not left[r, c]) else f"l{k}"
            elif ext[r, c]:
                cg[r][c] = "extrude"
            elif near[r, c]:
                cg[r][c] = "glow"
    emit_grid(cg)

    # fronteras: linea de 1px entre celdas de paises distintos
    for r in range(GH):
        c = 0
        while c < GW - 1:
            a, b = grid[r, c], grid[r, c + 1]
            if a and b and a != b:
                rect("border", (c + 1) * CELL - 1, r * CELL, 1, CELL)
            c += 1
    for r in range(GH - 1):
        c = 0
        while c < GW:
            a, b = grid[r, c], grid[r + 1, c]
            if a and b and a != b:
                e = c
                while e + 1 < GW and grid[r, e + 1] == a and grid[r + 1, e + 1] == b:
                    e += 1
                rect("border", c * CELL, (r + 1) * CELL - 1, (e - c + 1) * CELL, 1)
                c = e + 1
            else:
                c += 1

    # nubes pixel
    for cx, by in ((150, 70), (520, 60), (1400, 66), (1790, 72), (260, 600), (1700, 600), (380, 1170), (1150, 1160), (1650, 1175)):
        cloud(cx, by)

    # monumentos con pin en la ubicacion real
    for name, lon, lat, dx, dy in MONUMENTS:
        x, y = project(lon, lat)
        px, py = int(x) // 2 * 2, int(y) // 2 * 2
        if abs(dx) > 12 or abs(dy) > 12:
            steps = int(max(abs(dx), abs(dy)) / 6)
            for s in range(1, steps):
                rect("pin", int(px + dx * s / steps), int(py + dy * s / steps), 2, 2)
        rect("K", px - 4, py - 4, 8, 8)
        rect("pin", px - 2, py - 2, 4, 4)
        sprite(SPRITES[name], px + dx, py + dy)

    used = sorted({o.split('c-')[1].split('"')[0] for o in out})
    style = "".join(f".c-{n}{{fill:{PALETTE[n]}}}" for n in used)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
           f'shape-rendering="crispEdges" data-codeart="worldmap-synthwave"><style>{style}</style>'
           + "".join(out) + "</svg>")
    (HERE / "worldmap.svg").write_text(svg, encoding="utf-8")
    (HERE / "palette.json").write_text(json.dumps({"colors": {n: PALETTE[n] for n in used}}, indent=1), encoding="utf-8")
    print("overlaps:", overlaps())
    print(json.dumps({"svg": str(HERE / "worldmap.svg"), "elements": len(out), "horizon": horizon,
                      "kb": round(len(svg) / 1024)}))

if __name__ == "__main__":
    build()
