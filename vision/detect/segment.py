"""Pure image segmentation: Otsu threshold + external contours -> a blob
list. No dependency on anything else in this repo -- this is the low-level
part of the pipeline most likely to be reused as-is in a real product.

Same method as the original vision/main.py service; factored out here so
there is one implementation instead of two drifting apart.
"""

from __future__ import annotations

import math

import cv2
import numpy as np

MIN_AREA_FRACTION = 5e-4


def segment(gray: np.ndarray) -> np.ndarray:
    """Otsu threshold, oriented so deposits are foreground regardless of polarity."""
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    if np.count_nonzero(binary) > binary.size * 0.5:
        binary = cv2.bitwise_not(binary)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
    return cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)


def measure_blobs(binary: np.ndarray, frame_area: float) -> list[dict]:
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
                "circularity": float(min(1.0, 4 * math.pi * area / (perimeter**2))),
                "cx": float(m["m10"] / m["m00"]),
                "cy": float(m["m01"] / m["m00"]),
                "equivalent_diameter": float(2 * math.sqrt(area / math.pi)),
            }
        )
    return blobs


def segment_image(raw: bytes) -> tuple[np.ndarray, list[dict]] | None:
    """Bytes in, (bgr image, blob list) out. None if the bytes don't decode."""
    arr = np.frombuffer(raw, np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        return None
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    frame_area = float(gray.shape[0] * gray.shape[1])
    binary = segment(gray)
    blobs = measure_blobs(binary, frame_area)
    return bgr, blobs
