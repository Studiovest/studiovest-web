# Studiovest floor plan toolkit

Requirements: Python 3.10+, Pillow, numpy, opencv-python-headless, poppler-utils (for `pdfimages`).

Portal mode:
    python3 floorplan.py INPUT.pdf --office em_norge --first "Kjeller" --prefix 23_haugen_stord --json --out OUTDIR

- --office: em_norge | em1_sor | aktiv_sunnhordland | nordvik (aliases in offices/aliases.json)
- --first: first floor name (counts upward: Kjeller -> 1.Etasje -> 2.Etasje), a comma list
  ("1.etasje, 2.etasje, Loft"), or "Leilighet" (single floor)
- Uses the Cubicasa "without dimensions" PDF. The last page (all floors) is skipped automatically.
- Prints JSON: {"office": ..., "floor_pages": N, "files": [{"floor","page","file"}]}

Built-in rules: shared plan sizing (max 1720x1340, centred), 50 px logo clearance,
yellow separator-line removal for Aktiv and Nordvik.
