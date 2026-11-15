"""Variante "cartoon" del tablero: vector plano, contorno negro grueso, sombra dura y fichas sticker.

Estilo tomado de la UI de referencia (pasteles planos, borde #111, sombra desplazada sin blur).
Reutiliza datos, proyeccion de lat y coloreo de paises de build_worldmap.py.
Uso: python build_worldmap_cartoon.py  -> worldmap-cartoon.svg + palette-cartoon.json
"""
import json
import math
from pathlib import Path

import build_worldmap as bw

HERE = Path(__file__).parent
W, H = 1920, 1200
CARD = (40, 40, 1840, 1120)        # x, y, w, h de la tarjeta del mapa
MAP_W = CARD[2]
MAP_H = (bw.Y0 - bw.miller(bw.LAT_S)) * MAP_W / (2 * math.pi)
MAP_Y = CARD[1] + (CARD[3] - MAP_H) / 2
SHADOW = 7
BADGE = 66

PALETTE = {
    "bg": "#eaf2e6", "ink": "#111111", "paper": "#ffffff", "ocean": "#7ec4f5", "wave": "#a9d8fa",
    "yellow": "#ffd43b", "green": "#6bcf8b", "blue": "#7ec4f5", "coral": "#ff8a6b", "lilac": "#c7b3ff",
    "l0": "#fff0a8", "l1": "#bfe8c6", "l2": "#cfe6fb", "l3": "#ffcdbd", "l4": "#e3d9ff",
    "sand": "#ffe2a8", "snow": "#ffffff", "red": "#ff5a5a",
}
BADGE_COLORS = ["yellow", "green", "blue", "coral", "lilac"]

def project(lon, lat):
    x = CARD[0] + (lon + 180.0) / 360.0 * MAP_W
    y = MAP_Y + (bw.Y0 - bw.miller(max(min(lat, 89.0), -89.0))) * MAP_W / (2 * math.pi)
    return x, y

# ---------------------------------------------------------------- paises -> paths
def ring_path(ring, shift):
    pts, prev = [], None
    for lon, lat in ring:
        if prev is not None:
            while lon - prev > 180:
                lon -= 360
            while lon - prev < -180:
                lon += 360
        prev = lon
        x, y = project(lon + shift, lat)
        if not pts or abs(x - pts[-1][0]) + abs(y - pts[-1][1]) > 1.6:
            pts.append((x, y))
    if len(pts) < 3:
        return None, 0
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    bbox = (max(xs) - min(xs)) * (max(ys) - min(ys))
    if max(xs) < CARD[0] or min(xs) > CARD[0] + MAP_W:
        return None, 0
    d = "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z"
    return d, bbox

def country_paths(countries):
    out = []
    for i, polys in enumerate(countries):
        parts = []
        for poly in polys:
            for shift in (-360.0, 0.0, 360.0):
                d, bbox = ring_path(poly[0], shift)
                if not d or bbox < 40:
                    continue
                parts.append(d)
                for hole in poly[1:]:
                    hd, _ = ring_path(hole, shift)
                    if hd:
                        parts.append(hd)
        if parts:
            out.append((i + 1, "".join(parts)))
    return out

# ---------------------------------------------------------------- iconos (caja 40x40)
S = 'class="st c-{f}"'
def ic(*parts):
    return "".join(parts)

def P(d, f="paper"):
    return f'<path {S.format(f=f)} d="{d}"/>'

def L(d):
    return f'<path class="ln" d="{d}"/>'

def C(x, y, r, f="paper"):
    return f'<circle {S.format(f=f)} cx="{x}" cy="{y}" r="{r}"/>'

def R(x, y, w, h, f="paper", rx=0):
    return f'<rect {S.format(f=f)} x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}"/>'

ICONS = {
    "eiffel": ic(P("M11 36 L17.5 15 L19 4 L21 4 L22.5 15 L29 36 L25 36 Q20 27 15 36 Z"), L("M15.5 24 H24.5"), L("M17.5 15 H22.5")),
    "coliseo": ic(P("M4 33 V15 Q20 6 36 13 V33 Z", "sand"), L("M4 23 H36"),
                  L("M9 33 V29 Q11 26.5 13 29 V33 M18 33 V29 Q20 26.5 22 29 V33 M27 33 V29 Q29 26.5 31 29 V33"),
                  L("M9 19.5 V18 M14 19.5 V17 M19 19.5 V16.5 M24 19.5 V16.5 M29 19.5 V17")),
    "obelisco": ic(P("M16.5 34 L18 9 L20 4 L22 9 L23.5 34 Z"), R(12, 33, 16, 4, "paper", 1), L("M19.3 12 H20.7")),
    "cristo": ic(P("M3 37 Q12 26 20 28 Q30 27 37 37 Z", "green"), C(20, 7, 3), R(6, 11, 28, 4, "paper", 2),
                 P("M17.5 15 H22.5 L23.5 30 H16.5 Z")),
    "machu": ic(P("M3 35 L13 20 L18 25 L27 7 L37 35 Z", "green"), L("M8 30 H33 M11 26 H20"), R(9, 29, 9, 4, "sand")),
    "chichen": ic(P("M4 35 H36 L32 29 H8 Z M8 29 L11 23 H29 L32 29 M11 23 L14 17 H26 L29 23", "sand"),
                  R(15, 10, 10, 7, "sand"), P("M17.5 35 L19 17 H21 L22.5 35 Z", "paper")),
    "libertad": ic(R(12, 31, 16, 6, "sand", 1), P("M14 31 L16 17 H23 L25 31 Z", "green"), C(19, 13, 3.5, "green"),
                   P("M22 16 L27 6", "green"), P("M25 6 Q27 1 29 6 Z", "yellow"), L("M15.5 11 L13 8 M19 9.5 V6 M22.5 11 L25 9")),
    "golden": ic(R(9, 7, 4, 28, "coral"), R(27, 7, 4, 28, "coral"), L("M2 25 H38"),
                 P("M2 23 Q7 10 11 8 Q20 23 29 8 Q33 10 38 23", "none"), L("M4 33 Q8 31 12 33 M28 33 Q32 31 36 33")),
    "bigben": ic(P("M14 37 V13 L20 3 L26 13 V37 Z", "sand"), C(20, 18, 4, "paper"), L("M20 18 V15.5 M20 18 H22"),
                 L("M16 26 V33 M24 26 V33")),
    "partenon": ic(P("M4 14 L20 5 L36 14 Z"), R(5, 14, 30, 3), L("M8 17 V31 M14 17 V31 M20 17 V31 M26 17 V31 M32 17 V31"),
                   R(4, 31, 32, 4)),
    "basilio": ic(R(7, 22, 26, 14, "paper"), P("M20 3 Q28 11 20 16 Q12 11 20 3 Z", "coral"), R(17, 16, 6, 6, "paper"),
                  P("M10 11 Q15 16 10 20 Q5 16 10 11 Z", "green"), P("M30 11 Q35 16 30 20 Q25 16 30 11 Z", "blue"),
                  L("M17 36 V30 Q20 27 23 30 V36")),
    "piramides": ic(P("M2 35 L15 12 L28 35 Z", "sand"), P("M20 35 L29 20 L38 35 Z", "sand"), L("M15 12 L17 35")),
    "burj": ic(P("M20 2 L22 12 L24 14 L25 24 L27 26 L28 37 H12 L13 26 L15 24 L16 14 L18 12 Z", "blue"), L("M20 14 V34")),
    "taj": ic(P("M11 20 Q11 9 20 5 Q29 9 29 20 Z"), R(8, 20, 24, 15), L("M17 35 V27 Q20 23 23 27 V35"),
              L("M4 35 V14 M36 35 V14"), C(4, 12, 1.8), C(36, 12, 1.8)),
    "muralla": ic(P("M2 30 L12 22 L22 27 L38 16 V24 L22 34 L12 29 L2 37 Z", "sand"),
                  R(25, 12, 8, 12, "sand"), L("M25 12 V9 M29 12 V9 M33 12 V9")),
    "fuji": ic(P("M2 35 L14 12 H26 L38 35 Z", "blue"), P("M14 12 H26 L30 20 L26 18 L23 21 L19 17 L15 21 L11 18 Z", "snow"),
               C(31, 7, 4, "coral")),
    "angkor": ic(P("M3 35 V28 L8 18 L13 28 L16 28 L20 6 L24 28 L27 28 L32 18 L37 28 V35 Z", "sand"), L("M3 31 H37")),
    "opera": ic(P("M4 30 Q8 14 18 8 Q14 20 16 30 Z"), P("M14 30 Q20 14 30 10 Q24 22 26 30 Z"), P("M24 30 Q28 20 36 18 Q32 24 34 30 Z"),
                R(2, 30, 36, 5, "sand"), L("M3 38 Q8 36 13 38 M20 38 Q25 36 30 38")),
    "uluru": ic(P("M3 33 Q5 20 14 18 Q24 15 32 20 Q38 25 37 33 Z", "coral"), L("M14 22 V31 M24 20 V31"), C(31, 8, 4, "yellow")),
    "moai": ic(P("M13 37 V20 Q11 6 20 4 Q29 6 27 14 L30 22 L26 24 V37 Z", "paper"), L("M15 13 H25 M20 15 V22 M17 27 H24")),
    "sagrada": ic(P("M6 36 V14 L8 6 L10 14 V36 M30 36 V14 L32 6 L34 14 V36", "sand"),
                  P("M14 36 V10 L16 2 L18 10 V36 M22 36 V10 L24 2 L26 10 V36", "sand"), R(5, 24, 30, 12, "sand"),
                  L("M17 36 V31 Q20 28 23 31 V36")),
    "castillo": ic(R(8, 18, 24, 18), P("M6 18 L10 6 L14 18 Z M26 18 L30 6 L34 18 Z M16 14 L20 2 L24 14 Z", "blue"),
                   R(16, 14, 8, 6), L("M17 36 V30 Q20 27 23 30 V36")),
    "hagia": ic(P("M9 24 Q9 11 20 9 Q31 11 31 24 Z", "coral"), R(6, 24, 28, 12, "coral"), L("M3 36 V11 M37 36 V11"),
                C(3, 9, 1.8), C(37, 9, 1.8), L("M20 9 V5")),
    "kilimanjaro": ic(P("M1 35 L14 15 H26 L39 35 Z", "coral"), P("M14 15 H26 L28 18 L24 20 L20 17 L16 20 L12 18 Z", "snow"),
                      P("M5 6 Q8 2 11 6 Q15 4 15 8 H4 Q2 6 5 6 Z", "paper")),
    "table": ic(P("M2 34 L8 17 H32 L38 34 Z", "lilac"), P("M8 17 Q12 11 18 13 Q24 10 28 13 Q33 12 32 17 Z", "paper"),
                L("M3 38 Q9 36 15 38 M22 38 Q28 36 34 38")),
    "baobab": ic(P("M15 37 L17 18 H23 L25 37 Z", "sand"), P("M6 16 Q8 6 20 8 Q32 6 34 16 Q26 20 20 17 Q12 20 6 16 Z", "green")),
    "petronas": ic(P("M8 37 V14 L11 4 L14 14 V37 Z", "blue"), P("M26 37 V14 L29 4 L32 14 V37 Z", "blue"), R(14, 20, 12, 3)),
    "torii": ic(P("M3 8 Q20 12 37 8 L36 12 H4 Z", "red"), R(6, 16, 28, 3, "red"), R(10, 12, 3, 24, "red"), R(27, 12, 3, 24, "red"),
                L("M3 38 Q9 36 15 38 M22 38 Q28 36 34 38")),
    "cntower": ic(P("M17 37 L19 20 H21 L23 37 Z"), P("M14 17 Q20 12 26 17 Q20 22 14 17 Z", "coral"), L("M20 13 V2")),
    "needle": ic(P("M6 12 Q20 6 34 12 Q20 16 6 12 Z", "yellow"), P("M18 14 L16 37 M22 14 L24 37", "none"), L("M16 26 H24 M20 7 V2")),
    "iguazu": ic(P("M2 14 Q10 8 20 12 Q30 8 38 13 V18 H2 Z", "green"), R(4, 18, 32, 15, "blue"),
                 L("M9 19 V31 M15 19 V31 M21 19 V31 M27 19 V31 M33 19 V31"), L("M2 36 Q8 33 14 36 Q20 39 26 36 Q32 33 38 36")),
    "perito": ic(P("M2 30 V16 L7 12 L10 16 L15 9 L19 15 L24 10 L28 15 L33 11 L38 16 V30 Z", "blue"),
                 L("M10 18 V27 M19 17 V27 M28 18 V27"), L("M2 35 Q8 32 14 35 Q20 38 26 35 Q32 32 38 35")),
    "igloo": ic(P("M4 33 Q4 12 20 11 Q36 12 36 33 Z"), P("M15 33 V27 Q20 21 25 27 V33 Z", "blue"), L("M6 25 H15 M25 25 H34 M9 18 H31 M14 18 V25 M26 18 V25")),
    "totem": ic(P("M3 9 L14 7 V12 Z M37 9 L26 7 V12 Z", "yellow"), R(14, 5, 12, 10, "coral"), R(14, 15, 12, 10, "green"),
                R(14, 25, 12, 11, "blue"), L("M17 10 H18 M22 10 H23 M17 20 H18 M22 20 H23 M17 30 H18 M22 30 H23")),
    "tren": ic(R(3, 14, 14, 16, "coral", 2), R(19, 17, 18, 13, "blue", 2), R(5, 8, 4, 6, "coral"), R(6, 17, 7, 5, "paper"),
               C(8, 32, 3), C(14, 32, 3), C(24, 32, 3), C(32, 32, 3), L("M1 36 H39")),
    "camello": ic(P("M5 25 Q7 15 13 18 Q16 10 20 18 Q24 11 28 18 L31 12 L36 13 L33 16 L31 25 Z", "sand"),
                  L("M10 25 V36 M15 25 V36 M25 25 V36 M30 25 V36")),
}

# (nombre, lon, lat) - mismos lugares que el tablero pixel
PLACES = [(m[0], m[1], m[2]) for m in bw.MONUMENTS]

def layout_badges():
    pins = [project(lon, lat) for _, lon, lat in PLACES]
    pos = [[x, y - 46] for x, y in pins]
    min_d = BADGE + 10
    for _ in range(400):
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
        for p, (px, py) in zip(pos, pins):
            p[0] += (px - p[0]) * 0.02
            p[1] += (py - 46 - p[1]) * 0.02
            p[0] = min(max(p[0], CARD[0] + BADGE), CARD[0] + CARD[2] - BADGE)
            p[1] = min(max(p[1], CARD[1] + BADGE), CARD[1] + CARD[3] - BADGE)
        if not moved:
            break
    return pins, pos

# ---------------------------------------------------------------- composicion
def build():
    countries = bw.load_countries()
    col = bw.color_countries(bw.rasterize(countries))
    paths = country_paths(countries)
    x0, y0, cw, ch = CARD
    o = []
    o.append(f'<rect class="c-bg" x="0" y="0" width="{W}" height="{H}"/>')
    o.append(f'<rect class="c-ink" x="{x0 + 10}" y="{y0 + 10}" width="{cw}" height="{ch}" rx="36"/>')
    o.append(f'<rect class="c-ocean" x="{x0}" y="{y0}" width="{cw}" height="{ch}" rx="36"/>')
    o.append(f'<clipPath id="card"><rect x="{x0}" y="{y0}" width="{cw}" height="{ch}" rx="36"/></clipPath>')
    o.append('<g clip-path="url(#card)">')
    # olitas
    for k, (wx, wy) in enumerate(((140, 620), (300, 900), (760, 980), (960, 420), (1240, 900), (1500, 1000),
                                  (1820, 640), (90, 300), (720, 700), (1700, 830), (380, 560), (1100, 1080))):
        o.append(f'<path class="wv" d="M{wx} {wy} q10 -8 20 0 t20 0 t20 0"/>')
    land = "".join(d for _, d in paths)
    o.append(f'<path class="c-ink" fill-rule="evenodd" transform="translate({SHADOW} {SHADOW})" d="{land}"/>')
    o.append(f'<path class="c-ink coast" d="{land}"/>')
    for cid, d in paths:
        o.append(f'<path class="c-l{col.get(cid, 0)} bd" d="{d}"/>')
    o.append("</g>")
    o.append(f'<rect class="frame" x="{x0}" y="{y0}" width="{cw}" height="{ch}" rx="36"/>')

    pins, pos = layout_badges()
    for (px, py), (bx, by) in zip(pins, pos):
        o.append(f'<path class="lead" d="M{px:.1f} {py:.1f}L{bx:.1f} {by:.1f}"/>')
    for (px, py) in pins:
        o.append(f'<circle class="c-ink" cx="{px + 2.5:.1f}" cy="{py + 2.5:.1f}" r="7"/>')
        o.append(f'<circle class="st c-paper" cx="{px:.1f}" cy="{py:.1f}" r="7"/>')
    half = BADGE / 2
    for k, ((name, _, _), (bx, by)) in enumerate(zip(PLACES, pos)):
        rot = (-5, 3, -2, 4, -3, 2)[k % 6]
        colr = BADGE_COLORS[k % len(BADGE_COLORS)]
        o.append(f'<g transform="translate({bx:.1f} {by:.1f}) rotate({rot})">')
        o.append(f'<rect class="c-ink" x="{-half + 5}" y="{-half + 5}" width="{BADGE}" height="{BADGE}" rx="14"/>')
        o.append(f'<rect class="st c-{colr}" x="{-half}" y="{-half}" width="{BADGE}" height="{BADGE}" rx="14"/>')
        o.append(f'<g transform="scale(1.25) translate(-20 -20)">{ICONS[name]}</g></g>')

    used = sorted({c for c in PALETTE})
    style = ("".join(f".c-{n}{{fill:{PALETTE[n]}}}" for n in used)
             + ".c-none{fill:none}"
             + ".st{stroke:#111111;stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}"
             + ".ln{fill:none;stroke:#111111;stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}"
             + ".bd{fill-rule:evenodd;stroke:#111111;stroke-width:1.4;stroke-linejoin:round}"
             + ".coast{fill-rule:evenodd;stroke:#111111;stroke-width:6;stroke-linejoin:round}"
             + ".wv{fill:none;stroke:#a9d8fa;stroke-width:4;stroke-linecap:round}"
             + ".lead{fill:none;stroke:#111111;stroke-width:2.5;stroke-dasharray:2 6;stroke-linecap:round}"
             + ".frame{fill:none;stroke:#111111;stroke-width:6}")
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
           f'data-codeart="worldmap-cartoon"><style>{style}</style>' + "".join(o) + "</svg>")
    (HERE / "worldmap-cartoon.svg").write_text(svg, encoding="utf-8")
    (HERE / "palette-cartoon.json").write_text(json.dumps({"colors": PALETTE}, indent=1), encoding="utf-8")
    print(json.dumps({"svg": str(HERE / "worldmap-cartoon.svg"), "kb": round(len(svg) / 1024),
                      "badges": len(PLACES)}))

if __name__ == "__main__":
    build()
