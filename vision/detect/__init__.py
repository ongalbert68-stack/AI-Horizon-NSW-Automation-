"""Standalone defect detector: given a photo and (optionally) the recipe it
was dispensed from, says what's wrong and where.

Deliberately independent of everything else in this repo -- no FastAPI, no
import from vision/synth or vision/main.py -- so this folder can be copied
whole into a real product. It only depends on numpy and OpenCV, matching
what's already used elsewhere in vision/.

    segment.py  -- pure image -> blob list (Otsu threshold + contours)
    profile.py  -- the recipe a photo is checked against: where each dot was
                    supposed to land. A real machine already has this before
                    it dispenses anything; a detector shouldn't have to guess
                    a grid from pixels when it doesn't need to.
    align.py    -- matches detected blobs to the nearest profile position,
                    for any pattern shape (grid, perimeter, line, ...), not
                    just rectangular grids
    classify.py -- turns an aligned match into symptom tags (oversized,
                    missing, misaligned, irregular, ...)
    report.py   -- the public entry point, `detect(image_bytes, profile)`
    evaluate.py -- runs detect() against every generated sample and reports
                    how well each defect class is actually covered today
"""

from .report import detect

__all__ = ["detect"]
