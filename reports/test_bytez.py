# pip install bytez

import os
from pathlib import Path

from bytez import Bytez


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

# Read raw API key from env. Do not include "Key " prefix here.
_load_dotenv(Path(__file__).resolve().parents[1] / ".env")
key = os.getenv("BYTEZ_API_KEY")
if not key:
    raise RuntimeError("BYTEZ_API_KEY is not set in the environment.")

sdk = Bytez(key)

model = sdk.model("google/gemma-3-4b-it")
results = model.run([
    {"role": "user", "content": "Hello"}
])

print({"error": results.error, "output": results.output})
