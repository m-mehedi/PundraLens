"""DocAligner wrapper — detect document corners and crop/align the image."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from PIL import Image

if TYPE_CHECKING:
    from docaligner import DocAligner

logger = logging.getLogger(__name__)

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


def align_image(image: Image.Image) -> Image.Image:
    """Detect document corners in *image*, dewarp and return the cropped, aligned image.

    If corner detection fails, returns the original image unchanged (graceful degradation).
    """
    model = _load_model()

    # Convert PIL Image to numpy array (BGR for OpenCV)
    import cv2
    import numpy as np

    img_np = np.array(image)
    if len(img_np.shape) == 2:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
    else:
        img_np = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    try:
        from capybara import pad

        # Pad the image so the model can find corners near edges
        pad_size = 100
        padded = pad(img_np, pad_size)

        # Detect corners
        polygon = model(img=padded, do_center_crop=False)

        # Remove padding offset from corner coordinates
        polygon = polygon - pad_size

        # polygon is a list/array of 4 corner points [(x1,y1), (x2,y2), (x3,y3), (x4,y4)]
        pts = np.array(polygon, dtype=np.float32)

        # Compute the bounding box of the detected polygon to determine output size
        rect = cv2.minAreaRect(pts.astype(np.int32))
        width, height = int(rect[1][0]), int(rect[1][1])

        if width < 10 or height < 10:
            raise ValueError("Detected document area is too small")

        # Build transformation matrix for perspective warp
        # Target corners: top-left, top-right, bottom-right, bottom-left
        target_pts = np.array(
            [[0, 0], [width, 0], [width, height], [0, height]], dtype=np.float32
        )

        # Reorder source points to match target order
        # The polygon order from DocAligner is typically: top-left, top-right, bottom-right, bottom-left
        src_pts = pts.reshape(4, 2)

        matrix = cv2.getPerspectiveTransform(src_pts, target_pts)
        aligned = cv2.warpPerspective(img_np, matrix, (width, height))

        # Convert back to PIL Image (RGB)
        aligned_rgb = cv2.cvtColor(aligned, cv2.COLOR_BGR2RGB)
        return Image.fromarray(aligned_rgb)

    except Exception as e:
        logger.warning(f"DocAligner failed: {e}. Returning original image.")
        return image
