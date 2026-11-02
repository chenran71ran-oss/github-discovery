"""Classifier strategies: which signals count and how much. Compare them with
`python -m collector evaluate`; production uses the one named by CLASSIFIER_STRATEGY."""
from collector.blocks.classify.engine import Strategy

STRATEGIES = {s.name: s for s in (
    # Baseline: what the old single-label keyword rules could see.
    Strategy("keywords", {"keywords": 2, "language": 1}),
    # Authors' own GitHub topics are the strongest evidence.
    Strategy("topics", {"keywords": 2, "topics": 3, "language": 1}),
    # Everything the rules can see: topics, README head and detected tech stack, all facets equal.
    Strategy("flat", {"keywords": 2, "topics": 3, "readme": 0.5, "language": 1, "stacks": 0.5, "model": 6}),
    # Same evidence, but "what it is for" beats "what it is built with": tech-facet categories
    # (AI, frontend, backend, data, mobile/desktop) are discounted, so an AI photo editor is a photo
    # tool tagged AI, and an Android VPN is a security tool tagged mobile.
    Strategy("full", {"keywords": 2, "topics": 2, "readme": 0.5, "language": 1, "stacks": 0.5, "model": 6}, facet_bias={"tech": 0.7}),
)}
DEFAULT = "full"


def get(name: str | None = None) -> Strategy:
    return STRATEGIES.get(name or DEFAULT, STRATEGIES[DEFAULT])
