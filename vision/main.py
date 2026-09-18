"""Dispensing metrology service.

Classical computer vision, deliberately: no training data is required and every
number traces to a pixel measurement a process engineer can reproduce with a
microscope and a ruler. Thresholding is Otsu, shape is the standard isoperimetric
circularity ratio, dispersion is the coefficient of variation.
"""

from __future__ import annotations

import base64
import io
import math

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Dispensing Metrology", version="1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# Deposits smaller than this fraction of the frame are treated as sensor noise.
MIN_AREA_FRACTION = 5e-4
CIRCULARITY_IRREGULAR = 0.80
# Control limits as a fraction of the median deposit area. Median-based rather
# than mean +/- 2 sigma: with a bimodal population the standard deviation
# inflates until genuine outliers stop clearing the limit.
UNDERSIZED_LIMIT = 0.70
OVERSIZED_LIMIT = 1.40


def _segment(gray: np.ndarray) -> np.ndarray:
    """Otsu threshold, oriented so deposits are foreground regardless of polarity."""
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # If the "foreground" occupies most of the frame we picked the wrong polarity.
    if np.count_nonzero(binary) > binary.size * 0.5:
        binary = cv2.bitwise_not(binary)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
    return cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)


def _measure_blobs(binary: np.ndarray, frame_area: float) -> list[dict]:
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    blobs = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < frame_area * MIN_AREA_FRACTION:
            continue
        perimeter = cv2.arcLength(c, True)
        if perimeter <= 0:
            continue
        m = cv2.moments(c)
        if m["m00"] == 0:
            continue
        blobs.append(
            {
                "area": float(area),
                "perimeter": float(perimeter),
                # Isoperimetric ratio: 1.0 for a perfect circle, lower for tailing.
                "circularity": float(min(1.0, 4 * math.pi * area / (perimeter**2))),
                "cx": float(m["m10"] / m["m00"]),
                "cy": float(m["m01"] / m["m00"]),
                "equivalent_diameter": float(2 * math.sqrt(area / math.pi)),
            }
        )
    return sorted(blobs, key=lambda b: (round(b["cy"] / 40), b["cx"]))


def _position_deviation(blobs: list[dict]) -> tuple[float, int]:
    """Fit each detected row to an evenly-spaced lattice; report mean deviation.

    Returns (mean deviation in px, count of lattice positions with no deposit).
    """
    if len(blobs) < 3:
        return 0.0, 0

    heights = [b["equivalent_diameter"] for b in blobs]
    row_tol = max(np.median(heights) * 1.2, 10.0)

    rows: list[list[dict]] = []
    for blob in sorted(blobs, key=lambda b: b["cy"]):
        if rows and abs(blob["cy"] - np.mean([x["cy"] for x in rows[-1]])) <= row_tol:
            rows[-1].append(blob)
        else:
            rows.append([blob])

    deviations: list[float] = []
    missing = 0
    row_widths: list[int] = []

    for row in rows:
        row = sorted(row, key=lambda b: b["cx"])
        row_y = float(np.mean([b["cy"] for b in row]))
        if len(row) < 2:
            continue

        gaps = np.diff([b["cx"] for b in row])
        pitch = float(np.median(gaps))
        if pitch <= 0:
            continue

        # A gap near a whole multiple of the pitch means deposits are absent.
        row_gap_missing = 0
        for gap in gaps:
            steps = int(round(gap / pitch))
            if steps > 1:
                row_gap_missing += steps - 1
        missing += row_gap_missing
        row_widths.append(len(row) + row_gap_missing)

        # Least-squares fit of x against lattice index.
        indices = np.round((np.array([b["cx"] for b in row]) - row[0]["cx"]) / pitch)
        slope, intercept = np.polyfit(indices, [b["cx"] for b in row], 1)
        for blob, idx in zip(row, indices):
            dx = blob["cx"] - (slope * idx + intercept)
            dy = blob["cy"] - row_y
            deviations.append(float(math.hypot(dx, dy)))

    # Rows narrower than the widest row are missing deposits at an edge, where
    # no interior gap exists to reveal them.
    if row_widths:
        expected = max(row_widths)
        missing += sum(expected - w for w in row_widths)

    return (float(np.mean(deviations)) if deviations else 0.0), missing


def _annotate(bgr: np.ndarray, blobs: list[dict], flags: dict[int, list[str]]) -> str:
    out = bgr.copy()
    palette = {
        "ok": (120, 200, 120),
        "oversized": (80, 80, 240),
        "undersized": (240, 180, 60),
        "irregular": (240, 80, 220),
    }
    for i, b in enumerate(blobs):
        marks = flags.get(i) or ["ok"]
        centre = (int(b["cx"]), int(b["cy"]))
        base_radius = max(6, int(b["equivalent_diameter"] / 2) + 4)
        for ring, label in enumerate(marks):
            cv2.circle(out, centre, base_radius + ring * 5, palette[label], 2)
        cv2.putText(
            out, str(i + 1), (centre[0] - 6, centre[1] - base_radius - 8),
            cv2.FONT_HERSHEY_SIMPLEX, 0.45, palette[marks[0]], 1, cv2.LINE_AA,
        )
    ok, buf = cv2.imencode(".png", out)
    return base64.b64encode(buf).decode() if ok else ""


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "dispensing-metrology"}


def measure_image(raw: bytes, target_area: float | None = None) -> dict:
    """Measure a dispensing image. Pure: bytes in, measurements out."""
    arr = np.frombuffer(raw, np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        return {"error": "Could not decode that image."}

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    frame_area = float(gray.shape[0] * gray.shape[1])
    binary = _segment(gray)
    blobs = _measure_blobs(binary, frame_area)

    if not blobs:
        return {"error": "No deposits detected. Try a higher-contrast image."}

    areas = np.array([b["area"] for b in blobs])
    circs = np.array([b["circularity"] for b in blobs])
    mean_area = float(areas.mean())
    std_area = float(areas.std())
    size_cv = float(std_area / mean_area) if mean_area else 0.0
    median_area = float(np.median(areas))
    p90_area = float(np.percentile(areas, 90))
    spread_index = float(p90_area / median_area) if median_area else 1.0
    pos_dev, missing = _position_deviation(blobs)

    # Nominal deposit area: taken from the recipe when supplied, otherwise
    # inferred from the median. The inferred case assumes the majority of
    # deposits are correct - which is stated in the output rather than hidden,
    # because it fails precisely when most deposits are out of spec.
    nominal = target_area if target_area and target_area > 0 else median_area
    nominal_inferred = not (target_area and target_area > 0)

    flags: dict[int, list[str]] = {}
    oversized = undersized = irregular = 0
    for i, b in enumerate(blobs):
        marks: list[str] = []
        ratio = b["area"] / nominal if nominal else 1.0
        if ratio > OVERSIZED_LIMIT:
            marks.append("oversized"); oversized += 1
        elif ratio < UNDERSIZED_LIMIT:
            marks.append("undersized"); undersized += 1
        if b["circularity"] < CIRCULARITY_IRREGULAR:
            marks.append("irregular"); irregular += 1
        if marks:
            flags[i] = marks

    signals = [
        {"key": "blob_count", "label": "Deposits detected", "value": len(blobs)},
        {"key": "size_cv", "label": "Size dispersion (CV)", "value": round(size_cv, 4),
         "note": f"Standard deviation of deposit area is {size_cv * 100:.1f}% of the mean."},
        {"key": "mean_circularity", "label": "Mean circularity", "value": round(float(circs.mean()), 3),
         "note": "Isoperimetric ratio; 1.00 is a perfect circle, below 0.80 indicates tailing."},
        {"key": "position_deviation_px", "label": "Mean position deviation", "value": round(pos_dev, 2), "unit": " px",
         "note": "Centroid distance from the fitted lattice position."},
        {"key": "spread_index", "label": "Spread index", "value": round(spread_index, 3),
         "note": "90th-percentile area over median area; above 1.2 indicates some deposits are smeared."},
        {"key": "missing_count", "label": "Missing deposits", "value": missing,
         "note": "Lattice positions with a gap where a deposit was expected."},
        {"key": "oversized_count", "label": "Oversized deposits", "value": oversized, "note": "Area above mean + 2 sigma."},
        {"key": "undersized_count", "label": "Undersized deposits", "value": undersized, "note": "Area below mean - 2 sigma."},
        {"key": "irregular_count", "label": "Irregular deposits", "value": irregular, "note": f"Circularity below {CIRCULARITY_IRREGULAR}."},
        {"key": "mean_area_px", "label": "Mean deposit area", "value": round(mean_area, 1), "unit": " px2"},
        {"key": "nominal_area_px", "label": "Nominal deposit area", "value": round(nominal, 1), "unit": " px2",
         "note": ("Inferred from the median deposit - this assumes most deposits are within spec. "
                  "Supply the recipe target area to measure against the true nominal instead.")
                 if nominal_inferred else "Supplied from the dispensing recipe."},
    ]

    return {
        "signals": signals,
        "blobs": [{k: round(v, 3) for k, v in b.items()} for b in blobs],
        "annotated_png_b64": _annotate(bgr, blobs, flags),
    }


@app.post("/measure")
async def measure(
    file: UploadFile = File(...),
    target_area: float | None = Form(default=None),
) -> dict:
    return measure_image(await file.read(), target_area)
