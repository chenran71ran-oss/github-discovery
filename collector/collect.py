"""Backwards-compatible entry point; the collector now lives in the `collector` package.
Equivalent to `python -m collector run`."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from collector.app.cli import main  # noqa: E402

if __name__ == "__main__": main(["run"])
