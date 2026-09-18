"""Oracle test: each canonical sample encodes a known defect (see
synth/dataset.generate_canonical), so main.py's measurements must recover
it -- or, for the handful of classes main.py genuinely can't see yet, must
stay indistinguishable from a clean deposit. Those gaps are asserted
explicitly rather than skipped, so a future change to main.py that silently
breaks or silently fixes one shows up here instead of going unnoticed.
"""
import sys, pathlib
sys.path.insert(0, "/home/calvinkhoo/Documents/GitHub/AiHorizon/vision")
from main import measure_image

base = pathlib.Path("/home/calvinkhoo/Documents/GitHub/AiHorizon/vision/samples")
names = [
    "good", "smearing", "stringing", "satellite", "missing_carryover", "air_bubble",
    "abnormal_shape", "overrun", "dragged", "misaligned", "bridging_dots", "ghost",
    "inconsistent", "line_start_defect", "line_end_defect", "contamination_speck", "double_dispense",
]
rows = {}
for name in names:
    r = measure_image((base / f"{name}.png").read_bytes())
    s = {x["key"]: x["value"] for x in r["signals"]}
    rows[name] = s
    print(f"{name:20} n={s['blob_count']:2} cv={s['size_cv']:.3f} circ={s['mean_circularity']:.3f} "
          f"pos={s['position_deviation_px']:.1f} spread={s['spread_index']:.2f} miss={s['missing_count']} "
          f"over={s['oversized_count']} under={s['undersized_count']} irreg={s['irregular_count']}")

print("\n--- oracle assertions ---")
checks = [
    ("good is repeatable",              rows["good"]["size_cv"] < 0.10),
    ("good flags nothing",              rows["good"]["oversized_count"] + rows["good"]["undersized_count"] + rows["good"]["irregular_count"] == 0),
    ("good reads near-zero position",   rows["good"]["position_deviation_px"] < 1.0),

    ("smearing flags shape",            rows["smearing"]["irregular_count"] >= 1),
    ("stringing flags shape",           rows["stringing"]["irregular_count"] >= 1),

    ("missing_carryover finds all 3 misses",   rows["missing_carryover"]["missing_count"] == 3),
    ("missing_carryover flags the 3 carries as oversized", rows["missing_carryover"]["oversized_count"] == 3),
    ("missing_carryover is dispersed",         rows["missing_carryover"]["size_cv"] > 0.25),

    ("abnormal_shape flags shape",      rows["abnormal_shape"]["irregular_count"] >= 1),

    ("overrun flags oversized",         rows["overrun"]["oversized_count"] >= 1),
    ("overrun is dispersed",            rows["overrun"]["size_cv"] > 0.25),

    ("dragged fuses two deposits into one blob", rows["dragged"]["blob_count"] == 14),
    ("dragged flags shape",             rows["dragged"]["irregular_count"] >= 1),

    ("misaligned detects offset",       rows["misaligned"]["position_deviation_px"] > 2.0),
    ("misaligned leaves size/shape alone", rows["misaligned"]["oversized_count"] + rows["misaligned"]["undersized_count"] + rows["misaligned"]["irregular_count"] == 0),

    ("bridging_dots fuses two deposits into one blob", rows["bridging_dots"]["blob_count"] == 14),
    ("bridging_dots flags shape",       rows["bridging_dots"]["irregular_count"] >= 1),

    ("inconsistent is dispersed",       rows["inconsistent"]["size_cv"] > 0.25),

    ("line_end_defect flags oversized", rows["line_end_defect"]["oversized_count"] >= 1),
    # Not asserting irregular_count here: with adequate dot spacing (see
    # vision_detection_log.md's spacing-bug fix) the pooled end dot is a
    # well-separated, cleanly-measured ellipse, not distorted by touching
    # its neighbour -- oversized is the reliable signal, shape isn't.

    ("double_dispense flags oversized", rows["double_dispense"]["oversized_count"] >= 1),

    # --- known current gaps: main.py segments silhouette only (Otsu threshold
    # + external contour), so anything that doesn't change the outer outline,
    # or that's too small to clear the noise-area floor, is invisible to it
    # today. Asserted explicitly so a real fix -- or a silent regression --
    # shows up here rather than passing unnoticed. See img_type.txt's "Issues
    # better diagnosed with 3D scope" note for air_bubble specifically.
    ("air_bubble is texture-only: reads as a clean deposit", rows["air_bubble"]["oversized_count"] + rows["air_bubble"]["undersized_count"] + rows["air_bubble"]["irregular_count"] == 0),
    ("satellite falls below the area-noise floor: blob count unchanged", rows["satellite"]["blob_count"] == rows["good"]["blob_count"]),
    ("contamination_speck falls below the area-noise floor: blob count unchanged", rows["contamination_speck"]["blob_count"] == rows["good"]["blob_count"]),
    ("ghost's faint ring is erased by morphological opening: reads as missing", rows["ghost"]["missing_count"] >= 1),
    ("line_start_defect on a single-row line isn't caught: no wider row to compare against", rows["line_start_defect"]["missing_count"] == 0),
]
for name, ok in checks:
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
print(f"\n{sum(1 for _, ok in checks if ok)}/{len(checks)} passed")
