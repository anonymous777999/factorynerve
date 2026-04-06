import os
from pathlib import Path


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

def run_bytez_demo() -> dict[str, object]:
    try:
        from bytez import Bytez
    except ImportError as exc:  # pragma: no cover - optional local dependency
        raise RuntimeError("bytez package is not installed. Run `pip install bytez`.") from exc

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
    return {"error": results.error, "output": results.output}


if __name__ == "__main__":
    print(run_bytez_demo())
