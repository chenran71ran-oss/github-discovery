"""Static collection constants. Runtime settings (secrets, env switches) live in app.config."""
from datetime import timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "public/data"
TAXONOMY_FILE = ROOT / "shared/taxonomy.json"
PERIODS = ("daily", "weekly", "monthly")
TZ = timezone(timedelta(hours=8))
NO_DESCRIPTION = "无描述"

# GitHub Trending lists only about 8-20 repositories per page, mostly AI. Wider coverage comes from
# each language's own Trending page and from GitHub search streams (overall and per category).
LANGUAGE_POOLS = ("python", "typescript", "javascript", "go", "rust", "java", "c++", "c", "c#", "swift", "kotlin", "php")
POOL_SIZE = 5
# General search stream: repositories created within N days with at least M stars.
SEARCH_WINDOWS = {"daily": (7, 50), "weekly": (30, 150), "monthly": (90, 400)}
SEARCH_GENERAL = 30
# Category streams (each taxonomy category's streamTopics): wider windows, lower bars,
# so tools and everyday-life projects that never reach the main Trending page still surface.
TOPIC_WINDOWS = {"daily": (30, 15), "weekly": (60, 30), "monthly": (120, 80)}
TOPIC_PER_STREAM = 6
SEARCH_PAUSE = 2.1  # authenticated search allows 30 requests a minute

# Feature cache: README signals are refreshed after this many days.
README_TTL_DAYS = 14
META_TTL_DAYS = 3
README_BYTES = 6000
