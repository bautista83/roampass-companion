"""Tablero "vuelta al mundo" v2 (tematica mochilero).

- Continentes mas gordos: escala por continente + contorno engrosado.
- 50 casillas x 500 millas = 25.000 millas: 43 monumentos + 7 transportes.
- Decoracion: olas, surf, velero, ballena, oso polar, pinguinos y animales por continente.

Reutiliza build_board_route.py (datos, transformaciones, curva) y build_worldmap_cartoon.py (estilo).
Code-drawn, sin modelo de imagen. Uso: python build_board_v2.py
"""
import json
import math
import random
from pathlib import Path

import build_board_route as br
import build_worldmap_cartoon as cart

P, L, C, R, ic = cart.P, cart.L, cart.C, cart.R, cart.ic

HERE = Path(__file__).parent
W, H = 1920, 1200
CARD = cart.CARD
TOTAL_MILES = 25000
MILES_PER_SPACE = 500
BADGE = 64
TRANSPORT_R = 31

# continentes mas grandes (escala, dx, dy, centro lon/lat)
br.GROUPS.update({
    "na": (1.14, -26, 18, (-100, 45)),
    "sa": (1.32, 6, 30, (-60, -15)),
    "eu": (1.85, -86, -18, (12, 50)),
    "af": (1.24, -14, 66, (20, 5)),
    "as": (1.08, 10, 14, (95, 45)),
    "oc": (1.38, 4, 34, (135, -25)),
    "nz": (1.4, -52, 40, (172, -41)),
    "pac": (1.0, 0, 0, (0, 0)),
})

PALETTE = dict(br.PALETTE)
PALETTE.update({"ice": "#e3f4ff", "grey": "#bcc3dc", "brown": "#d39a68", "orange": "#ff9f43", "whale": "#6f8fe6"})

# ---------------------------------------------------------------- transportes (casillas redondas)
TRANSPORT_ICONS = {
    "t_barco": ic(P("M3 26 H37 L32 34 H8 Z", "coral"), R(10, 17, 18, 9, "paper"), R(22, 9, 5, 8, "red"),
                  C(14, 21.5, 1.6, "blue"), C(19, 21.5, 1.6, "blue"), L("M2 38 Q8 35 14 38 Q20 41 26 38 Q32 35 38 38")),
    "t_globo": ic(P("M20 2 Q33 2 33 15 Q33 23 23 29 H17 Q7 23 7 15 Q7 2 20 2 Z", "coral"),
                  P("M20 2 Q14 14 17 29 H23 Q26 14 20 2 Z", "yellow"), L("M17 29 L18 33 M23 29 L22 33"),
                  R(16, 33, 8, 5, "brown", 1)),
    "t_camello": br.ICONS["camello"],
    "t_tren": br.ICONS["tren"],
    "t_avion": ic(P("M3 23 L17 21 L23 7 H27 L25 21 L35 21 Q39 23 35 25 L25 25 L27 35 H23 L17 27 L3 25 Z", "paper"),
                  L("M3 23 L1 17 H5 L8 22")),
    "t_combi": ic(P("M8 6 H32 Q34 4.5 32 3 H8 Q6 4.5 8 6 Z", "yellow"), P("M4 31 V15 Q4 8 11 8 H30 Q36 8 37 16 L38 31 Z", "coral"),
                  P("M4 20 V15 Q4 8 11 8 H30 Q36 8 36.7 15 L37 20 Z", "paper"), R(9, 11, 7, 6, "blue", 1),
                  R(18, 11, 7, 6, "blue", 1), R(27, 11, 7, 6, "blue", 1), C(12, 31, 4, "ink"), C(30, 31, 4, "ink")),
    "t_tuktuk": ic(R(12, 5, 22, 4, "green", 1), P("M14 9 V30 H34 V9 Z", "yellow"), P("M14 12 L4 24 V30 H14 Z", "yellow"),
                   R(18, 13, 12, 8, "paper", 1), C(8, 31, 3.5, "ink"), C(22, 31, 3.5, "ink"), C(31, 31, 3.5, "ink")),
}
ICONS = dict(br.ICONS)
ICONS.update(TRANSPORT_ICONS)

POS = dict(br.POS)
POS.update({
    "t_barco": (-30, 57), "t_globo": (34.8, 38.6), "t_camello": (-6, 28), "t_tren": (92, 56),
    "t_tuktuk": (100.5, 13.8), "t_combi": (138, -31), "t_avion": (-155, -28),
})
GROUP = dict(br.STATION_GROUP)
GROUP.update({"t_barco": "pac", "t_globo": "as", "t_camello": "af", "t_tren": "as", "t_tuktuk": "as",
              "t_combi": "oc", "t_avion": "pac"})

ROUTE = [
    "obelisco", "iguazu", "cristo", "amazonas", "machu", "chichen", "golden", "needle", "totem", "cntower",
    "libertad", "igloo", "t_barco", "bigben", "eiffel", "castillo", "basilio", "t_globo", "hagia", "partenon",
    "coliseo", "sagrada", "t_camello", "tombuctu", "table", "victoria", "baobab", "kilimanjaro", "lalibela",
    "piramides", "petra", "burj", "taj", "everest", "t_tren", "muralla", "torii", "fuji", "halong", "angkor",
    "t_tuktuk", "petronas", "borobudur", "uluru", "t_combi", "opera", "kiwi", "t_avion", "moai", "perito",
]
assert len(ROUTE) * MILES_PER_SPACE == TOTAL_MILES, len(ROUTE)
WRAP_AFTER = "kiwi"

# ---------------------------------------------------------------- decoracion (caja 60x60)
DECOR = {
    "oso": ic(P("M2 40 L8 31 H64 L70 40 L62 48 H10 Z", "ice"),
              P("M14 31 Q11 17 26 16 H44 Q47 10 54 12 L58 11 Q65 13 63 19 L57 21 Q55 28 52 31 Z", "snow"),
              L("M21 31 V27 M30 31 V28 M45 31 V28"), C(57, 15, 0.9, "ink"), C(63, 18, 1.3, "ink"), C(51, 11, 2.2, "snow")),
    "pinguinos": ic(P("M2 50 L8 42 H54 L60 50 L52 56 H10 Z", "ice"),
                    *[ic(P(f"M{x - 9} 28 L{x - 14} 36 L{x - 8} 35 Z M{x + 9} 28 L{x + 14} 36 L{x + 8} 35 Z", "ink"),
                         P(f"M{x} 8 Q{x + 10} 10 {x + 10} 26 Q{x + 10} 43 {x} 43 Q{x - 10} 43 {x - 10} 26 Q{x - 10} 10 {x} 8 Z", "ink"),
                         P(f"M{x} 14 Q{x + 7} 14 {x + 6.5} 23 Q{x + 7.5} 30 {x + 6.5} 35 Q{x + 5} 41 {x} 41 Q{x - 5} 41 {x - 6.5} 35 Q{x - 7.5} 30 {x - 6.5} 23 Q{x - 7} 14 {x} 14 Z", "snow"),
                         C(x - 3, 19, 1.4, "ink"), C(x + 3, 19, 1.4, "ink"),
                         P(f"M{x - 4} 22 L{x + 4} 22 L{x} 27 Z", "orange"),
                         P(f"M{x - 7} 43 H{x - 1} L{x - 4} 46 Z M{x + 1} 43 H{x + 7} L{x + 4} 46 Z", "orange"))
                      for x in (19, 41)]),
    "surf": ic(P("M8 52 Q2 32 18 6 Q30 22 20 48 Q16 56 8 52 Z", "coral"), L("M11 44 Q12 30 19 12"),
               P("M24 54 Q28 34 46 38 Q36 42 40 54 Z", "paper"), L("M0 57 Q10 53 20 57 Q30 61 40 57 Q50 53 60 57")),
    "velero": ic(P("M6 40 H54 L46 50 H14 Z", "coral"), L("M30 40 V6"), P("M31 8 L50 36 H31 Z", "paper"),
                 P("M29 13 L14 36 H29 Z", "yellow"), P("M30 6 L37 8 L30 10 Z", "red"),
                 L("M0 54 Q10 50 20 54 Q30 58 40 54 Q50 50 60 54")),
    "ballena": ic(P("M4 36 Q8 18 30 20 Q48 22 50 32 L58 24 Q61 32 56 38 Q50 44 30 44 Q8 44 4 36 Z", "whale"),
                  L("M10 38 Q28 42 44 38"), C(14, 30, 1.3, "ink"), L("M24 18 Q22 10 17 8 M24 18 Q26 10 31 8 M24 18 V7")),
    "aleta": ic(P("M14 40 Q22 30 26 12 Q34 30 42 40 Z", "grey"), L("M2 42 Q10 38 18 42 Q26 46 34 42 Q42 38 50 42 Q56 45 60 42")),
    "pez": ic(P("M6 30 Q18 18 34 26 L44 18 V42 L34 34 Q18 42 6 30 Z", "orange"), C(14, 28, 1.3, "ink"), L("M24 26 Q27 30 24 34")),
    "avion": ic(L("M-70 46 Q-36 22 4 31"),
                P("M6 30 L28 28 L36 14 H42 L38 28 L52 28 Q58 30 52 33 L38 33 L42 46 H36 L28 34 L6 32 Z", "paper")),
    "globo": ic(P("M30 4 Q48 4 48 22 Q48 34 34 42 H26 Q12 34 12 22 Q12 4 30 4 Z", "lilac"),
                P("M30 4 Q22 20 26 42 H34 Q38 20 30 4 Z", "yellow"), L("M26 42 L27 48 M34 42 L33 48"),
                R(25, 48, 10, 7, "brown", 1)),
    "iceberg": ic(P("M4 40 L14 20 L22 26 L30 8 L42 24 L50 18 L58 40 Z", "ice"), L("M30 8 L28 22 M14 20 L18 32"),
                  L("M0 44 Q10 40 20 44 Q30 48 40 44 Q50 40 60 44")),
    "alce": ic(P("M10 30 Q10 20 22 20 H40 Q46 20 48 14 L54 14 Q58 18 56 24 L50 26 Q48 32 44 34 H14 Q10 34 10 30 Z", "brown"),
               L("M16 34 V46 M22 34 V46 M38 34 V46 M44 34 V46"),
               P("M48 13 Q42 3 37 6 Q42 8 46 13 Z M54 13 Q60 3 64 6 Q59 8 55 13 Z", "sand"), C(53, 17, 0.9, "ink")),
    "cactus": ic(P("M24 52 V14 Q24 6 30 6 Q36 6 36 14 V52 Z", "green"),
                 P("M24 32 H17 Q12 32 12 27 V19 Q12 15 16 15 Q20 15 20 19 V25 H24 Z", "green"),
                 P("M36 36 H43 Q48 36 48 31 V23 Q48 19 44 19 Q40 19 40 23 V29 H36 Z", "green"),
                 L("M6 52 H54 M30 14 V48")),
    "llama": ic(P("M10 30 Q10 22 18 22 H36 V8 Q36 4 40 4 H44 Q48 4 47 9 L44 10 V30 Q44 36 38 36 H16 Q10 36 10 30 Z", "paper"),
                L("M40 4 L39 0 M44 4 L45 0 M16 36 V48 M22 36 V48 M34 36 V48 M40 36 V48"), R(20, 22, 12, 8, "coral", 1),
                C(43, 7, 0.9, "ink")),
    "tucan": ic(L("M2 47 H42"), P("M14 46 Q6 30 14 18 Q20 10 30 12 Q34 20 30 34 L34 50 L24 46 Z", "ink"),
                P("M23 14 Q30 13 30 22 Q26 24 22 20 Z", "yellow"), P("M30 14 Q46 11 54 22 Q44 24 30 22 Z", "orange"),
                C(26, 16, 1.6, "snow")),
    "molino": ic(P("M22 54 L26 24 H34 L38 54 Z", "coral"), P("M24 24 Q30 16 36 24 Z", "coral"),
                 P("M30 22 L30 2 L35 4 L32 22 Z M30 22 L50 22 L48 27 L30 24 Z M30 22 L30 42 L25 40 L28 22 Z M30 22 L10 22 L12 17 L30 20 Z", "paper"),
                 C(30, 22, 2.5, "ink"), L("M28 54 V48 Q30 45 32 48 V54"),
                 C(10, 52, 3, "red"), C(16, 52, 3, "yellow"), C(46, 52, 3, "red"), C(52, 52, 3, "lilac")),
    "jirafa": ic(P("M10 34 Q10 26 18 26 H30 L38 6 Q40 2 44 4 L50 6 Q52 10 48 11 L44 10 L36 30 Q34 38 28 38 H16 Q10 38 10 34 Z", "yellow"),
                 L("M14 38 V54 M20 38 V54 M28 38 V54 M33 36 V54 M44 4 V0 M47 5 V1"),
                 C(18, 31, 2.5, "brown"), C(26, 31, 2, "brown"), C(36, 20, 1.8, "brown"), C(39, 13, 1.5, "brown"),
                 C(47, 7, 0.8, "ink")),
    "elefante": ic(P("M10 40 Q8 18 28 16 Q44 14 46 26 Q52 26 54 36 Q56 46 52 50 Q50 44 48 40 L46 50 H40 V42 H22 V50 H16 V42 Q10 44 10 40 Z", "grey"),
                   P("M36 20 Q30 22 32 32 Q40 34 42 26 Z", "grey"), C(42, 24, 1, "ink"), L("M46 34 Q50 37 53 34")),
    "panda": ic(P("M12 46 Q8 28 24 26 H38 Q52 28 48 46 Z", "snow"), C(21, 9, 4, "ink"), C(39, 9, 4, "ink"),
                C(30, 18, 11, "snow"), C(25, 18, 3.5, "ink"), C(35, 18, 3.5, "ink"), C(25, 18, 1, "snow"),
                C(35, 18, 1, "snow"), C(30, 23, 1.5, "ink"),
                P("M14 34 Q10 40 16 44 Q20 40 20 34 Z M46 34 Q50 40 44 44 Q40 40 40 34 Z", "ink"), L("M52 52 L57 18 M55 30 L60 27")),
    "canguro": ic(P("M6 52 Q18 50 24 44 Q20 32 25 22 Q29 14 35 14 L36 5 L40 12 L43 5 L44 14 Q50 16 50 20 L46 22 Q40 24 38 32 Q44 42 40 50 L48 54 H32 Q28 48 24 46 Q16 52 6 52 Z", "brown"),
                  L("M30 34 Q34 38 32 42 M38 26 L44 32"), C(45, 17, 0.9, "ink")),
    "mochila": ic(P("M14 14 Q14 6 30 6 Q46 6 46 14 V48 Q46 54 40 54 H20 Q14 54 14 48 Z", "green"),
                  P("M14 14 Q14 6 30 6 Q46 6 46 14 V24 H14 Z", "yellow"), R(20, 34, 20, 14, "green", 3),
                  L("M30 24 V30 M26 6 Q30 0 34 6"), C(30, 30, 1.6, "ink")),
}

# (tipo, grupo, lon, lat, escala)
DECOR_PLACES = [
    ("oso", "pac", 5, 80, 1.15), ("oso", "pac", 160, 78, 0.9), ("iceberg", "pac", -60, 62, 0.9),
    ("pinguinos", "pac", -22, -58, 1.1), ("pinguinos", "pac", 120, -55, 1.0), ("pinguinos", "pac", 40, -56, 0.9),
    ("surf", "pac", -155, 22, 1.0), ("surf", "pac", 108, -32, 0.9), ("surf", "pac", -15, -20, 0.9),
    ("velero", "pac", -45, 28, 1.0), ("velero", "pac", 160, 10, 0.9), ("ballena", "pac", -125, -5, 1.1),
    ("ballena", "pac", 75, -32, 1.0), ("aleta", "pac", 168, -22, 0.9), ("aleta", "pac", -100, -45, 0.9),
    ("pez", "pac", -20, 0, 0.8), ("pez", "pac", 65, 5, 0.8), ("pez", "pac", -160, -45, 0.8),
    ("avion", "pac", -40, 42, 0.9), ("globo", "pac", -135, 40, 0.9), ("globo", "pac", 60, -15, 0.8),
    ("alce", "na", -115, 60, 1.0), ("cactus", "na", -111, 33, 0.95), ("llama", "sa", -68, -40, 0.8),
    ("tucan", "sa", -55, -10, 0.95), ("molino", "eu", 22, 60, 0.9), ("jirafa", "af", 15, 12, 1.0),
    ("elefante", "af", 24, -12, 0.9), ("panda", "as", 104, 31, 0.95), ("canguro", "oc", 119, -22, 0.85),
    ("alce", "as", 125, 62, 0.9),
]

LAND_DECOR = {"alce", "cactus", "llama", "tucan", "molino", "jirafa", "elefante", "panda", "canguro"}
AIR_DECOR = {"avion", "globo"}
DECOR_SCALE = 1.45
MASK_K = 2                          # mascara a 1/2 de resolucion

def land_mask(lands, only=None):
    """Mascara booleana de tierra (incluye el engorde del contorno); `only` limita a un grupo."""
    from PIL import Image, ImageDraw, ImageFilter
    img = Image.new("L", (W // MASK_K, H // MASK_K), 0)
    d = ImageDraw.Draw(img)
    for g, path in lands.items():
        if only and g != only:
            continue
        for sub in path.split("M")[1:]:
            pts = []
            for tok in sub.rstrip("Z").split("L"):
                x, y = tok.split()
                pts.append((float(x) / MASK_K, float(y) / MASK_K))
            if len(pts) > 2:
                d.polygon(pts, fill=255)
    img = img.filter(ImageFilter.MaxFilter(5))
    import numpy as np
    return np.array(img) > 0

def on_land(mask, x, y):
    xi, yi = int(x / MASK_K), int(y / MASK_K)
    if not (0 <= xi < mask.shape[1] and 0 <= yi < mask.shape[0]):
        return False
    return bool(mask[yi, xi])

def area_is(mask, x, y, r, want_land):
    pts = [(x, y)] + [(x + r * math.cos(a), y + r * math.sin(a)) for a in [k * math.pi / 4 for k in range(8)]]
    return all(on_land(mask, px, py) == want_land for px, py in pts)

# ---------------------------------------------------------------- layout
def layout_stations():
    target = [br.place(GROUP[n], *POS[n]) for n in ROUTE]
    pos = [list(t) for t in target]
    min_d = BADGE + 22
    for _ in range(800):
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
            p[0] += (tx - p[0]) * 0.012
            p[1] += (ty - p[1]) * 0.012
            p[0] = min(max(p[0], CARD[0] + BADGE * 0.8), CARD[0] + CARD[2] - BADGE * 0.8)
            p[1] = min(max(p[1], CARD[1] + BADGE * 0.8), CARD[1] + CARD[3] - BADGE * 0.8)
        if not moved:
            break
    return pos

def place_decor(pos, legs, span, mask, group_masks):
    road = []
    for seg in legs:
        for x, y in seg:
            road.append((x - span if x > CARD[0] + CARD[2] + 10 else x, y))
    taken = [(x, y, 52) for x, y in pos] + [(x, y, 22) for x, y in road]
    out = []
    for kind, g, lon, lat, sc in DECOR_PLACES:
        sc = sc * DECOR_SCALE * (1.25 if kind == "pinguinos" else 1.0)
        x0, y0 = br.place(g, lon, lat)
        r = 30 * sc
        best = None
        for k in range(0, 500):
            ang = k * 2.4
            rad = 9 * math.sqrt(k)
            x, y = x0 + rad * math.cos(ang), y0 + rad * math.sin(ang)
            if not (CARD[0] + r + 8 < x < CARD[0] + CARD[2] - r - 8 and CARD[1] + r + 8 < y < CARD[1] + CARD[3] - r - 8):
                continue
            if kind in LAND_DECOR:
                if not area_is(group_masks[g], x, y, r * 0.5, True):
                    continue
            elif kind not in AIR_DECOR and not area_is(mask, x, y, r * 0.8, False):
                continue
            if all(math.dist((x, y), (tx, ty)) > tr + r for tx, ty, tr in taken):
                best = (x, y)
                break
        if best:
            taken.append((best[0], best[1], r))
            out.append((kind, best[0], best[1], sc))
    return out

def free_waves(taken, mask, n=40, seed=7):
    rnd = random.Random(seed)
    out = []
    tries = 0
    while len(out) < n and tries < 4000:
        tries += 1
        x = rnd.uniform(CARD[0] + 40, CARD[0] + CARD[2] - 90)
        y = rnd.uniform(CARD[1] + 40, CARD[1] + CARD[3] - 30)
        if not all(not on_land(mask, x + dx, y) for dx in (-6, 20, 30, 40, 66)) or on_land(mask, x + 30, y - 12):
            continue
        if all(math.dist((x + 30, y), (tx, ty)) > tr + 34 for tx, ty, tr in taken):
            out.append((x, y))
            taken.append((x + 30, y, 30))
    return out

# ---------------------------------------------------------------- composicion
def build():
    lands, argentina = br.land_paths()
    pos = layout_stations()
    legs = br.catmull([tuple(p) for p in pos], wrap=ROUTE.index(WRAP_AFTER), span=float(CARD[2]))
    wi, span = ROUTE.index(WRAP_AFTER), float(CARD[2])
    mask = land_mask(lands)
    group_masks = {g: land_mask(lands, g) for g in ("na", "sa", "eu", "af", "as", "oc")}
    decor = place_decor(pos, legs, span, mask, group_masks)
    x0, y0, cw, ch = CARD
    o = [f'<rect class="c-bg" x="0" y="0" width="{W}" height="{H}"/>',
         f'<rect class="c-ink" x="{x0 + 10}" y="{y0 + 10}" width="{cw}" height="{ch}" rx="36"/>',
         f'<rect class="c-ocean" x="{x0}" y="{y0}" width="{cw}" height="{ch}" rx="36"/>',
         f'<clipPath id="card"><rect x="{x0}" y="{y0}" width="{cw}" height="{ch}" rx="36"/></clipPath>',
         '<g clip-path="url(#card)">']

    # tierra engordada: sombra y contorno gruesos, relleno con trazo del mismo color
    order = ("as", "oc", "nz", "af", "na", "sa", "eu")
    for g in order:
        d = lands[g]
        o.append(f'<path class="c-ink fat-sh" transform="translate({cart.SHADOW} {cart.SHADOW})" d="{d}"/>')
        o.append(f'<path class="c-ink fat-coast" d="{d}"/>')
        o.append(f'<path class="c-{br.GROUP_COLOR[g]} fat-{br.GROUP_COLOR[g]}" d="{d}"/>')
        if g == "sa":
            o.append(f'<path class="c-arg bd" d="{argentina}"/>')

    # olas en el agua libre
    taken = [(x, y, 52) for x, y in pos] + [(x, y, 30 * sc + 6) for _, x, y, sc in decor]
    for seg in legs:
        taken += [((x - span if x > x0 + cw + 10 else x), y, 22) for x, y in seg[::3]]
    for wx, wy in free_waves(taken, mask):
        o.append(f'<path class="wv" d="M{wx:.0f} {wy:.0f} q10 -8 20 0 t20 0 t20 0"/>')

    # decoracion
    for kind, x, y, sc in decor:
        o.append(f'<g transform="translate({x:.1f} {y:.1f}) scale({sc}) translate(-30 -30)">{DECOR[kind]}</g>')

    # camino
    def poly_d(seg, dx=0.0):
        return "M" + "L".join(f"{x + dx:.1f} {y:.1f}" for x, y in seg)
    road = []
    for i, seg in enumerate(legs):
        road.append(poly_d(seg + [legs[(i + 1) % len(legs)][0] if i != wi else seg[-1]]))
        if i == wi:
            road.append(poly_d(seg, -span))
    rd = "".join(road)
    o.append(f'<path class="road-out" transform="translate(5 5)" d="{rd}"/>')
    o.append(f'<path class="road-out" d="{rd}"/>')
    o.append(f'<path class="road-in" d="{rd}"/>')
    o.append(f'<path class="road-dash" d="{rd}"/>')
    o.append("</g>")
    o.append(f'<rect class="frame" x="{x0}" y="{y0}" width="{cw}" height="{ch}" rx="36"/>')

    # casillas
    for k, (name, (bx, by)) in enumerate(zip(ROUTE, pos)):
        rot = (-4, 3, -2, 4, -3, 2)[k % 6]
        if name.startswith("t_"):
            r = TRANSPORT_R
            o.append(f'<circle class="c-ink" cx="{bx + 5:.1f}" cy="{by + 5:.1f}" r="{r}"/>')
            o.append(f'<circle class="st c-paper" cx="{bx:.1f}" cy="{by:.1f}" r="{r}"/>')
            o.append(f'<circle class="ring" cx="{bx:.1f}" cy="{by:.1f}" r="{r - 6}"/>')
            o.append(f'<g transform="translate({bx:.1f} {by:.1f}) rotate({rot}) scale(1.15) translate(-20 -20)">{ICONS[name]}</g>')
            continue
        g = GROUP[name]
        size = BADGE + 18 if k == 0 else BADGE
        hs = size / 2
        colr = "yellow" if k == 0 else br.BADGE_COLOR[g]
        o.append(f'<g transform="translate({bx:.1f} {by:.1f}) rotate({rot})">')
        o.append(f'<rect class="c-ink" x="{-hs + 5}" y="{-hs + 5}" width="{size}" height="{size}" rx="14"/>')
        o.append(f'<rect class="st c-{colr}" x="{-hs}" y="{-hs}" width="{size}" height="{size}" rx="14"/>')
        o.append(f'<g transform="scale({1.2 * size / BADGE:.3f}) translate(-20 -20)">{ICONS[name]}</g></g>')

    # salida: bandera a cuadros + mochila
    fx, fy = pos[0][0] - 70, pos[0][1] - 34
    o.append(f'<path class="ln" d="M{fx:.1f} {fy + 46:.1f} V{fy:.1f}"/>')
    o.append(f'<rect class="st c-paper" x="{fx:.1f}" y="{fy:.1f}" width="30" height="20"/>')
    for r in range(2):
        for c in range(3):
            if (r + c) % 2 == 0:
                o.append(f'<rect class="c-ink" x="{fx + c * 10:.1f}" y="{fy + r * 10:.1f}" width="10" height="10"/>')
    o.append(f'<g transform="translate({pos[0][0] + 66:.1f} {pos[0][1] + 30:.1f}) scale(1.0) translate(-30 -30)">{DECOR["mochila"]}</g>')

    style = ("".join(f".c-{n}{{fill:{PALETTE[n]}}}" for n in PALETTE) + ".c-none{fill:none}"
             + "".join(f".fat-{n}{{stroke:{PALETTE[n]};stroke-width:9;stroke-linejoin:round}}"
                       for n in set(br.GROUP_COLOR.values()))
             + ".fat-sh{stroke:#111111;stroke-width:9;stroke-linejoin:round}"
             + ".fat-coast{stroke:#111111;stroke-width:15;stroke-linejoin:round}"
             + ".st{stroke:#111111;stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}"
             + ".ln{fill:none;stroke:#111111;stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}"
             + ".bd{stroke:#111111;stroke-width:2;stroke-linejoin:round}"
             + ".ring{fill:none;stroke:#111111;stroke-width:1.6;stroke-dasharray:3 4}"
             + ".wv{fill:none;stroke:#a9d8fa;stroke-width:4;stroke-linecap:round}"
             + ".road-out{fill:none;stroke:#111111;stroke-width:18;stroke-linecap:round;stroke-linejoin:round}"
             + ".road-in{fill:none;stroke:#ffffff;stroke-width:11;stroke-linecap:round;stroke-linejoin:round}"
             + ".road-dash{fill:none;stroke:#111111;stroke-width:2;stroke-dasharray:6 8;stroke-linecap:round}"
             + ".frame{fill:none;stroke:#111111;stroke-width:6}")
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
           f'data-codeart="worldmap-board-v2"><style>{style}</style>' + "".join(o) + "</svg>")
    (HERE / "board-v2.svg").write_text(svg, encoding="utf-8")
    (HERE / "palette-board-v2.json").write_text(json.dumps({"colors": PALETTE}, indent=1), encoding="utf-8")
    track = [{"space": i, "type": "transport" if n.startswith("t_") else "monument", "id": n,
              "miles": i * MILES_PER_SPACE} for i, n in enumerate(ROUTE)]
    (HERE / "board-v2.json").write_text(json.dumps({"total_miles": TOTAL_MILES, "miles_per_space": MILES_PER_SPACE,
                                                    "spaces": len(ROUTE), "track": track}, indent=1), encoding="utf-8")
    print(json.dumps({"svg": str(HERE / "board-v2.svg"), "kb": round(len(svg) / 1024), "spaces": len(ROUTE),
                      "decor": len(decor), "decor_skipped": len(DECOR_PLACES) - len(decor)}))

if __name__ == "__main__":
    build()
