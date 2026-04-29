import os
from pathlib import Path

import pytest


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value

@pytest.mark.skipif(
    os.getenv("RUN_BYTEZ_INTEGRATION") != "1",
    reason="Set RUN_BYTEZ_INTEGRATION=1 to run the optional Bytez integration test",
)
def test_bytez_hello():
    bytez = pytest.importorskip("bytez")

    _load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    key = os.getenv("BYTEZ_API_KEY")
    if not key:
        pytest.skip("BYTEZ_API_KEY is not configured for this environment")

    sdk = bytez.Bytez(key)
    model = sdk.model("google/gemma-3-4b-it")
    results = model.run([{"role": "user", "content": "Hello"}])

    assert results.error is None
    assert results.output
