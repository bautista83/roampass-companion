"""Tablero en modo 80s: la misma geometria que board-v3 (casillas en el mismo lugar), recoloreado en
paleta synthwave y pixelado. Code-drawn, sin modelo de imagen.

Pasos:
  1. python build_board_retro.py svg
       -> board-retro.svg (board-v3.svg + una hoja de estilo que pisa los colores)
       -> client/public/board/spaces-retro/ (fichas de las casillas en neon)
  2. renderizar board-retro.svg a PNG 1920x1200 (codeart2d svg_render.py, backend chrome)
  3. python build_board_retro.py pixel <png renderizado>
       -> client/public/board/board-retro.png (640x400, paleta reducida; la app lo muestra pixelado)
"""
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
ROOT = HERE.parent.parent

RETRO = {
    # agua y fondo
    "bg": "#12021f", "ocean": "#1a0630", "wave": "#3a0d5c",
    # continentes (tonos de la version pixel del mapa)
    "na": "#4b3bd1", "sa": "#6a2bc2", "eu": "#b02ab8", "af": "#e2569e", "as": "#8f3fb0", "oc": "#c13cb0",
    "an": "#b8f3ff", "arg": "#ffd23f",
    # fichas en neon
    "yellow": "#ffd23f", "green": "#2de2a6", "blue": "#3ef2ff", "coral": "#ff6ec7", "lilac": "#b388ff",
    "ink": "#0b0114",
}
NEON_PINK, NEON_CYAN = "#ff2bd6", "#3ef2ff"


def build_svg():
    svg = (HERE / "board-v3.svg").read_text(encoding="utf-8")
    style = ("".join(f".c-{k}{{fill:{v}}}" for k, v in RETRO.items())
             + f".fat-sh{{fill:{NEON_PINK};stroke:{NEON_PINK}}}"
             + f".fat-coast{{fill:{NEON_PINK};stroke:{NEON_PINK}}}"
             + f".wv{{stroke:{RETRO['wave']}}}"
             + f".road-out{{stroke:{NEON_PINK}}}"
             + f".road-in{{stroke:#12021f}}"
             + f".road-dash{{stroke:{NEON_CYAN}}}"
             + f".frame{{stroke:{NEON_CYAN}}}")
    # los mismos colores de los continentes engordados (trazo del color del relleno)
    style += "".join(f".fat-{k}{{stroke:{RETRO[k]}}}" for k in ("na", "sa", "eu", "af", "as", "oc", "an"))
    out = svg.replace("</svg>", f'<style data-retro="80s">{style}</style></svg>')
    (HERE / "board-retro.svg").write_text(out, encoding="utf-8")
    print(HERE / "board-retro.svg")


def build_icons():
    """Fichas de las casillas en neon, para el lugar destacado del tablero digital en modo 80s."""
    src = ROOT / "client" / "public" / "board" / "spaces"
    dest = ROOT / "client" / "public" / "board" / "spaces-retro"
    dest.mkdir(exist_ok=True)
    style = "".join(f".c-{k}{{fill:{v}}}" for k, v in RETRO.items() if k not in ("bg", "ocean", "wave"))
    for icon in src.glob("*.svg"):
        svg = icon.read_text(encoding="utf-8").replace("</svg>", f"<style>{style}</style></svg>")
        (dest / icon.name).write_text(svg, encoding="utf-8")
    print(dest)


def pixelate(png):
    im = Image.open(png).convert("RGB")
    small = im.resize((640, 400), Image.Resampling.BOX)
    small = small.quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    dest = ROOT / "client" / "public" / "board" / "board-retro.png"
    small.save(dest, optimize=True)
    print(dest, small.size)


if __name__ == "__main__":
    if sys.argv[1:2] == ["svg"]:
        build_svg()
        build_icons()
    elif sys.argv[1:2] == ["pixel"] and len(sys.argv) == 3:
        pixelate(sys.argv[2])
    else:
        sys.exit(__doc__)
