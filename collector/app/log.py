"""Logging: readable lines on stderr, plus one JSON summary line per run on stdout."""
import json
import logging
import sys
import time
from contextlib import contextmanager


def setup(level: str = "INFO"):
    logging.basicConfig(stream=sys.stderr, level=getattr(logging, level.upper(), logging.INFO), format="%(asctime)s %(levelname)s %(name)s: %(message)s", datefmt="%H:%M:%S", force=True)
    # requests/urllib3 are chatty at INFO and could print URLs with query strings
    logging.getLogger("urllib3").setLevel(logging.WARNING)


@contextmanager
def timed(log: logging.Logger, stage: str, timings: dict):
    start = time.monotonic()
    log.info("stage %s started", stage)
    try: yield
    finally:
        timings[stage] = round(time.monotonic() - start, 2)
        log.info("stage %s finished in %.1fs", stage, timings[stage])


def summary(**fields):
    print(json.dumps(fields, ensure_ascii=False))
