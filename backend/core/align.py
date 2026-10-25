"""Document alignment — detect corners and perspective-warp from four points."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, List, Optional, Sequence, Tuple

from PIL import Image

import cv2
import numpy as np

if TYPE_CHECKING:
    from docaligner import DocAligner

logger = logging.getLogger(__name__)

Point = Tuple[float, float]

# Module-level model cache — loaded once on first call
_model: DocAligner | None = None


def _load_model() -> "DocAligner":
    """Load the DocAligner model (cached across calls)."""
    global _model
    if _model is None:
        from docaligner import DocAligner

        _model = DocAligner(model_cfg="fastvit_sa24")
        logger.info("DocAligner model loaded (fastvit_sa24)")
    return _model


def _detect_corners_by_channel(
    model: "DocAligner", img_np: "np.ndarray", pad_size: int
) -> Optional[List[Optional[Point]]]:
    """Detect corners by running the heatmap postprocess on one channel at a time.

    The model's own postprocess drops channels that fall below the heatmap
    threshold, which shifts the surviving points left — so a result of
    ``[TL, TR, BL]`` would be indistinguishable from ``[TL, TR, BR]``.
    Processing each channel separately keeps the exact channel→corner mapping.

    Returns None if the docaligner internals are unavailable, so the caller
    can fall back to the model's aggregated output.
    """
    try:
        from docaligner.heatmap_reg.infer import postprocess, preprocess

        detector = model.detector
        img_infos = preprocess(
            img=img_np,
            img_size_infer=detector.img_size_infer,
            do_center_crop=False,
        )
        heatmap = detector.model(**img_infos["input"])["heatmap"]
        imgs_size = img_infos["img_size_ori"]

        corners: List[Optional[Point]] = [None, None, None, None]
        for i in range(min(4, heatmap.shape[1])):
            points = postprocess(
                preds=heatmap[:, i : i + 1], imgs_size=imgs_size
            )
            if points and len(points[0]) == 2:
                x, y = points[0]
                corners[i] = (float(x) - pad_size, float(y) - pad_size)

        return corners

    except Exception as e:
        logger.warning(f"Per-channel corner detection unavailable: {e}")
        return None


def _clamp_corners(
    corners: List[Optional[Point]], width: int, height: int
) -> List[Optional[Point]]:
    """Clamp every corner into the image bounds.

    The heatmap postprocess returns the centroid of the largest detected
    blob, which can land outside the image (typically inside the padding
    ring, giving negative coordinates). A negative corner is rejected by
    ``POST /api/extract`` ("percentages 0-100"), so the whole notice fails
    to extract. Clamping here keeps the contract "0 <= x <= 100" true for
    every caller.
    """
    clamped: List[Optional[Point]] = []
    for corner in corners:
        if corner is None:
            clamped.append(None)
            continue
        x = min(max(float(corner[0]), 0.0), float(width))
        y = min(max(float(corner[1]), 0.0), float(height))
        clamped.append((x, y))
    return clamped


def detect_corners(image: Image.Image) -> List[Optional[Point]]:
    """Detect document corners in *image*.

    Returns a fixed-length 4-slot list in TL→TR→BR→BL order. A slot is None
    when that corner was not detected. Never raises: on any failure returns
    [None, None, None, None]. Every returned point lies inside the image.
    """
    model = _load_model()

    img_np = np.array(image)
    if len(img_np.shape) == 2:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
    else:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    width, height = image.size

    try:
        from capybara import pad

        pad_size = 100
        padded = pad(img_np, pad_size)

        # Preferred path: one channel at a time, so a missing corner keeps
        # its slot instead of shifting the others left.
        corners = _detect_corners_by_channel(model, padded, pad_size)
        if corners is not None:
            return _clamp_corners(corners, width, height)

        # Fallback: the model's aggregated output (channels may shift).
        polygon = model(img=padded, do_center_crop=False)

        if polygon.size == 0:
            return [None, None, None, None]

        polygon = polygon - pad_size
        pts = np.array(polygon, dtype=np.float32)

        if pts.ndim != 2 or pts.shape[1] != 2:
            return [None, None, None, None]

        n_pts = min(pts.shape[0], 4)
        pts = pts[:n_pts]

        corners = [None, None, None, None]
        for i, (x, y) in enumerate(pts):
            corners[i] = (float(x), float(y))

        return _clamp_corners(corners, width, height)

    except Exception as e:
        logger.warning(f"Corner detection failed: {e}")
        return [None, None, None, None]


def _order_corners(corners: Sequence[Point]) -> np.ndarray:
    """Order 4 corners canonically: TL, TR, BR, BL."""
    pts = np.array(corners, dtype=np.float32)
    centroid = pts.mean(axis=0)
    angles = np.arctan2(pts[:, 1] - centroid[1], pts[:, 0] - centroid[0])
    order = np.argsort(angles)
    pts = pts[order]
    tl_idx = np.argmin(pts[:, 0] + pts[:, 1])
    pts = np.roll(pts, -tl_idx, axis=0)
    return pts


def _compute_output_size(pts: np.ndarray) -> Tuple[int, int]:
    """Compute output width and height from ordered corners TL, TR, BR, BL."""
    tl, tr, br, bl = pts
    width_top = np.linalg.norm(tr - tl)
    width_bottom = np.linalg.norm(br - bl)
    height_left = np.linalg.norm(bl - tl)
    height_right = np.linalg.norm(br - tr)
    width = int(max(width_top, width_bottom))
    height = int(max(height_left, height_right))
    return width, height


def warp_with_corners(image: Image.Image, corners: Sequence[Point]) -> Image.Image:
    """Warp *image* using exactly 4 corner points (TL, TR, BR, BL).

    Args:
        image: Source PIL image.
        corners: Sequence of 4 (x, y) points in pixel coords of the original image.

    Returns:
        Warped PIL image.

    Raises:
        ValueError: If corners is not exactly 4 points or points are degenerate.
    """
    if len(corners) != 4:
        raise ValueError(f"Expected exactly 4 corners, got {len(corners)}")

    pts = _order_corners(corners)

    width, height = _compute_output_size(pts)
    if width < 10 or height < 10:
        raise ValueError("Computed output size is too small (degenerate corners)")

    target_pts = np.array(
        [[0, 0], [width, 0], [width, height], [0, height]], dtype=np.float32
    )

    img_np = np.array(image)
    if len(img_np.shape) == 2:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
    else:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    matrix = cv2.getPerspectiveTransform(pts, target_pts)
    aligned = cv2.warpPerspective(img_np, matrix, (width, height))
    aligned_rgb = cv2.cvtColor(aligned, cv2.COLOR_BGR2RGB)
    return Image.fromarray(aligned_rgb)
