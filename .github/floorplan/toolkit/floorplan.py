#!/usr/bin/env python3
"""Studiovest floor plan builder.

Takes a Cubicasa PDF export, extracts each floor page, and lays it out on the
template for a realtor office (canvas, logos, floor title, disclaimer).

Usage:
  python3 floorplan.py INPUT.pdf "Kjeller | EM Norge" [--out OUTDIR]

The job line is: <first floor> | <office>. First floor is Kjeller, 1.etasje,
2.etasje ... (counts upward), a full comma list
("1.etasje, 2.etasje, Loft"), or Leilighet (single-floor apartment). The last Cubicasa page
(all floors combined) is skipped.
"""
import argparse, json, os, subprocess, sys, tempfile, glob
from PIL import Image, ImageDraw, ImageFont
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = []  # meldinger til portalen (f.eks. fjernede gule streker)
FONTS = {
    "regular": "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "bold": "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "playfair-regular": os.path.join(HERE, "fonts", "PlayfairDisplay-400.ttf"),
    "playfair-bold": os.path.join(HERE, "fonts", "PlayfairDisplay-700.ttf"),
    "baskerville-regular": os.path.join(HERE, "fonts", "LibreBaskerville-400.ttf"),
    "baskerville-bold": os.path.join(HERE, "fonts", "LibreBaskerville-700.ttf"),
    "almarai-regular": os.path.join(HERE, "fonts", "Almarai-400.ttf"),
    "almarai-bold": os.path.join(HERE, "fonts", "Almarai-700.ttf"),
}


def extract_pages(pdf, workdir):
    """Return a list of RGBA images, one per PDF page (Cubicasa embeds one
    raster image + soft mask per page)."""
    subprocess.run(["pdfimages", "-png", pdf, os.path.join(workdir, "p")], check=True)
    files = sorted(glob.glob(os.path.join(workdir, "p-*.png")))
    pages = []
    for img_f, mask_f in zip(files[0::2], files[1::2]):
        im = Image.open(img_f).convert("RGB")
        m = Image.open(mask_f).convert("L")
        rgba = im.convert("RGBA"); rgba.putalpha(m)
        pages.append(rgba)
    return pages


def remove_separator_lines(img):
    """Remove Cubicasa's thin yellow/gold room-separator lines (a Cubicasa bug
    on styled plans, e.g. between Stue and Spisestue). Pixels that are a blend
    of a background colour and the line colour are repainted from their
    surroundings. Returns (image, number_of_pixels_removed)."""
    import cv2
    a = np.array(img.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = a.mean(-1)
    yellowness = (r + g) / 2 - b
    cand = (yellowness > 45) & (lum > 140) & (lum < 225) & (r > g) & (g > b)
    if cand.sum() < 50:
        return img, 0
    # line colour = most common candidate colour
    cols, counts = np.unique(a[cand].astype(np.uint8), axis=0, return_counts=True)
    Y = cols[counts.argmax()].astype(np.float32)
    # background colours = most common bright, low-saturation colours
    flat = a.reshape(-1, 3).astype(np.uint8)
    bc, bn = np.unique(flat, axis=0, return_counts=True)
    order = bn.argsort()[::-1]
    bases = [bc[i].astype(np.float32) for i in order[:12]
             if bc[i].mean() > 200 and (bc[i].max() - bc[i].min()) < 40][:5]
    core = np.zeros(a.shape[:2], bool)
    soft = np.zeros(a.shape[:2], bool)
    for F in bases:
        d = Y - F
        t = ((a - F) * d).sum(-1) / (d * d).sum()
        resid = np.linalg.norm(a - F - t[..., None] * d, axis=-1)
        core |= (t > 0.6) & (t < 1.15) & (resid < 12)
        soft |= (t > 0.2) & (t < 1.15) & (resid < 10)
    soft |= core
    # keep only soft components that contain core pixels and are long & thin
    n_lab, lab, stats, _ = cv2.connectedComponentsWithStats(soft.astype(np.uint8), connectivity=8)
    has_core = np.zeros(n_lab, bool); has_core[np.unique(lab[core])] = True
    keep = np.zeros(n_lab, bool)
    for i in range(1, n_lab):
        w, h, area = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT], stats[i, cv2.CC_STAT_AREA]
        length = max(w, h)
        if has_core[i] and length >= 40 and area / length < 8:
            keep[i] = True
    mask = keep[lab]
    n = int(mask.sum())
    if n == 0:
        return img, 0
    m8 = cv2.dilate(mask.astype(np.uint8), np.ones((3, 3), np.uint8))
    out = cv2.inpaint(a.astype(np.uint8)[..., ::-1].copy(), m8, 3, cv2.INPAINT_TELEA)[..., ::-1]
    return Image.fromarray(out), n


def crop_plan(page, cfg):
    """Crop the drawing only: drop Cubicasa's footer (logo + their disclaimer)
    and trim to the drawing's bounding box."""
    w, h = page.size
    footer = int(h * cfg.get("cubicasa_footer_fraction", 0.10))
    body = page.crop((0, 0, w, h - footer))
    bg = Image.new("RGB", body.size, "white"); bg.paste(body, mask=body.split()[3])
    if cfg.get("remove_separator_lines"):
        bg, n = remove_separator_lines(bg)
        if n:
            print(f"  removed {n} px of separator lines", file=sys.stderr)
            LOG.append(f"removed {n} px of separator lines")
    a = np.array(bg.convert("L")) < 245
    ys, xs = np.where(a)
    return bg.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def place_logo(canvas, path, box):
    """box = [x, y, w, h]; logo fitted inside, anchored top-left of box."""
    logo = Image.open(path).convert("RGBA")
    x, y, bw, bh = box
    s = min(bw / logo.width, bh / logo.height)
    logo = logo.resize((round(logo.width * s), round(logo.height * s)), Image.LANCZOS)
    canvas.paste(logo, (x, y), logo)


def text_centered(draw, cx, top, text, font, fill=(0, 0, 0)):
    """Place text so the top of its ink sits at `top`, centered on cx."""
    l, t, r, b = font.getbbox(text)
    draw.text((cx - (r - l) / 2 - l, top - t), text, font=font, fill=fill)


# One sizing rule for all offices (derived from the hand-placed examples):
# plan is scaled to fill as much as possible of a max area of 1720 x 1340 px,
# centered at (1288, 813) on the 2576 x 1821 canvas. Tall plans hit the height
# limit, wide plans hit the width limit.
PLAN_MAX_W, PLAN_MAX_H, PLAN_CX, PLAN_CY = 1720, 1340, 1288, 813


def render(plan, title, cfg):
    W, H = cfg["canvas"]
    canvas = Image.new("RGB", (W, H), "white")
    mw, mh = cfg.get("plan_max", [PLAN_MAX_W, PLAN_MAX_H])
    cx, cy = cfg.get("plan_center", [PLAN_CX, PLAN_CY])
    s = min(mw / plan.width, mh / plan.height)
    # keep a clear margin around the logos: shrink the plan until its box
    # does not come within LOGO_MARGIN px of any logo box
    LOGO_MARGIN = 50
    def hits(s):
        w, h = plan.width * s, plan.height * s
        x0, y0, x1, y1 = cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2
        for lg in cfg["logos"]:
            lx, ly, lw, lh = lg["box"]
            if x0 < lx + lw + LOGO_MARGIN and x1 > lx - LOGO_MARGIN and \
               y0 < ly + lh + LOGO_MARGIN and y1 > ly - LOGO_MARGIN:
                return True
        return False
    while hits(s):
        s *= 0.99
    p = plan.resize((round(plan.width * s), round(plan.height * s)), Image.LANCZOS)
    canvas.paste(p, (cx - p.width // 2, cy - p.height // 2))
    for logo in cfg["logos"]:
        place_logo(canvas, os.path.join(HERE, "assets", logo["file"]), logo["box"])
    d = ImageDraw.Draw(canvas)
    cx = cfg.get("text_center_x", W // 2)
    color = cfg.get("text_color", "#000000")
    t = cfg["title"]
    text_centered(d, cx, t["top"], title, ImageFont.truetype(FONTS[t["font"]], t["size"]), color)
    dc = cfg["disclaimer"]
    f = ImageFont.truetype(FONTS[dc["font"]], dc["size"])
    for i, line in enumerate(dc["lines"]):
        text_centered(d, cx, dc["top"] + i * dc["line_pitch"], line, f, color)
    return canvas


def norm(name):
    """'1.etasje' -> '1.Etasje', 'loft' -> 'Loft', 'kjeller' -> 'Kjeller'."""
    name = name.strip()
    if "." in name and name.split(".")[0].isdigit():
        n, rest = name.split(".", 1)
        return f"{n}.{rest.strip().capitalize()}"
    return name[:1].upper() + name[1:]


def floor_names(first, n_pages):
    """Cubicasa: one page per floor + a final all-floors page (never delivered).
    - 'Leilighet' = single floor, page 1 only.
    - A comma list ('1.etasje, 2.etasje, Loft') is used exactly as typed.
    - One name ('Kjeller' / '1.etasje') counts upward: Kjeller -> 1.Etasje -> 2.Etasje ..."""
    n = n_pages - 1 if n_pages > 1 else 1
    if "," in first:
        names = [norm(x) for x in first.split(",") if x.strip()]
        if len(names) != n:
            raise SystemExit(f"{len(names)} floor names given, but the PDF has {n} floor pages")
        return names
    f = first.strip().lower()
    if f == "leilighet":
        return ["Leilighet"]
    if f == "kjeller":
        return ["Kjeller"] + [f"{i}.Etasje" for i in range(1, n)]
    start = int(f.split(".")[0])
    return [f"{start + i}.Etasje" for i in range(n)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("order", nargs="?", help='Job line as typed, e.g. "Kjeller | EM Norge"')
    ap.add_argument("--office", help="Office key or alias (portal mode), e.g. em_norge")
    ap.add_argument("--first", help='First floor or comma list (portal mode), e.g. "Kjeller"')
    ap.add_argument("--prefix", default="", help="File name prefix, e.g. address slug")
    ap.add_argument("--json", action="store_true", help="Print a JSON result for the backend")
    ap.add_argument("--out", default="output")
    a = ap.parse_args()
    if a.order is None:
        if not (a.office and a.first):
            raise SystemExit("Give either the job line or --office and --first")
        a.order = f"{a.first} | {a.office}"
    sep = "|" if "|" in a.order else ","
    parts = [x.strip() for x in a.order.split(sep, 1)] if sep == "|" else None
    if parts is None:  # comma form: "EM 1, Kjeller" -> office is the part found in aliases
        al = json.load(open(os.path.join(HERE, "offices", "aliases.json")))
        bits = [x.strip() for x in a.order.split(",")]
        off = [b for b in bits if b.lower() in al]
        if len(off) != 1:
            raise SystemExit("Could not find exactly one office in: " + a.order)
        rest = [b for b in bits if b != off[0]]
        parts = [", ".join(rest), off[0]]
    aliases = json.load(open(os.path.join(HERE, "offices", "aliases.json")))
    # accept "Kjeller | EM Norge" or "EM Norge | Kjeller"
    if parts[0].lower() in aliases and parts[1].lower() not in aliases:
        parts.reverse()
    first, office = parts
    key = aliases.get(office.lower())
    if not key:
        raise SystemExit(f"Unknown office '{office}'. Known: {', '.join(aliases)}")
    cfg = json.load(open(os.path.join(HERE, "offices", key + ".json")))
    os.makedirs(a.out, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        pages = extract_pages(a.pdf, tmp)
        a.floors = floor_names(first, len(pages))
        pages_idx = list(range(1, len(a.floors) + 1))
        results = []
        for n, title in zip(pages_idx, a.floors):
            LOG.append(f"page {n} ({title}):")
            img = render(crop_plan(pages[n - 1], cfg), title, cfg)
            fn = os.path.join(a.out, title.replace(" ", "_").replace(".", "") + "." + cfg.get("format", "jpg"))
            if a.prefix:
                fn = os.path.join(a.out, a.prefix + "_" + os.path.basename(fn))
            img.save(fn, quality=95)
            results.append({"floor": title, "page": n, "file": fn})
            if not a.json:
                print(fn)
        if a.json:
            print(json.dumps({"office": key, "floor_pages": len(pages) - 1 if len(pages) > 1 else 1,
                              "files": results, "log": LOG}, ensure_ascii=False))


if __name__ == "__main__":
    main()
