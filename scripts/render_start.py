"""Render container startup for FactoryNerve backend."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

env = os.environ.copy()
existing_pythonpath = env.get("PYTHONPATH", "").strip()
paths = [str(PROJECT_ROOT)]
if existing_pythonpath:
    paths.append(existing_pythonpath)
env["PYTHONPATH"] = os.pathsep.join(paths)

port = env.get("PORT", "10000")

subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True, cwd=str(PROJECT_ROOT), env=env)
os.execvpe(
    sys.executable,
    [
        sys.executable,
        "-m",
        "uvicorn",
        "backend.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        port,
    ],
    env,
)
