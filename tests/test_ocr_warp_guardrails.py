from io import BytesIO

import numpy as np
from PIL import Image

from backend import ocr_utils


def _make_test_image_bytes() -> bytes:
    image = Image.new("RGB", (821, 1125), color=(250, 250, 250))
    output = BytesIO()
    image.save(output, format="JPEG", quality=90)
    return output.getvalue()


def test_corners_cover_enough_image_rejects_tiny_detection():
    tiny = np.array(
        [[673.0, 1002.0], [791.0, 1004.0], [792.0, 1037.0], [675.0, 1036.0]],
        dtype=np.float32,
    )

    assert ocr_utils._corners_cover_enough_image(tiny, image_width=821, image_height=1125) is False


def test_warp_perspective_ignores_tiny_auto_detected_corners(monkeypatch):
    image_bytes = _make_test_image_bytes()
    tiny_corners = [[673.0, 1002.0], [791.0, 1004.0], [792.0, 1037.0], [675.0, 1036.0]]

    monkeypatch.setattr(ocr_utils, "auto_detect_document_corners", lambda _image_bytes: tiny_corners)

    warped_bytes, applied = ocr_utils.warp_perspective(image_bytes)

    assert warped_bytes == image_bytes
    assert applied is None
