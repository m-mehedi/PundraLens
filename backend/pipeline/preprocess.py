"""Image preprocessing module — deskew, noise removal, contrast enhancement, and cropping."""

from __future__ import annotations

import logging
import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


def enhance_and_denoise_image(image: Image.Image) -> Image.Image:
    """Preprocess notice image by removing noise and enhancing contrast.

    Applies:
    1. Grayscale conversion check
    2. Bilateral filtering / Gaussian blur to preserve edges while smoothing noise
    3. CLAHE (Contrast Limited Adaptive Histogram Equalization) for uneven shadows
    4. Light sharpening

    Args:
        image: PIL Image object.

    Returns:
        Enhanced PIL Image object.
    """
    try:
        img_np = np.array(image.convert("RGB"))

        # Convert to LAB color space to apply CLAHE only to luminance channel (L)
        lab = cv2.cvtColor(img_np, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)

        # Apply CLAHE to L channel to balance harsh shadows and paper brightness
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_enhanced = clahe.apply(l)

        lab_enhanced = cv2.merge((l_enhanced, a, b))
        enhanced_rgb = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2RGB)

        # Apply mild bilateral filter to remove paper grain/sensor noise while keeping text sharp
        denoised = cv2.bilateralFilter(enhanced_rgb, d=5, sigmaColor=50, sigmaSpace=50)

        return Image.fromarray(denoised)
    except Exception as e:
        logger.warning(f"Image enhancement failed: {e}. Falling back to original image.")
        return image


def binarize_for_ocr(image: Image.Image) -> Image.Image:
    """Apply adaptive thresholding for high-contrast black/white OCR optimization."""
    try:
        img_np = np.array(image.convert("L"))
        # Otsu or Adaptive Gaussian thresholding
        thresh = cv2.adaptiveThreshold(
            img_np, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 10
        )
        return Image.fromarray(thresh)
    except Exception as e:
        logger.warning(f"Binarization failed: {e}. Returning original image.")
        return image
