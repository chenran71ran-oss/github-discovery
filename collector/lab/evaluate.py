"""Scores classifier strategies against hand-labelled real repositories.

gold.json is the tuning set: keywords and weights may be adjusted while looking at its errors.
holdout.json is never used for tuning; its score is the honest estimate of real accuracy.

    python -m collector evaluate            # keywords, topics and language only (offline)
    python -m collector evaluate --readme   # also README signals (fetched once, cached locally)

Accuracy = primary category matches the label; Top-tags = label is the primary or a secondary tag.
"""
import json
from collections import Counter
from pathlib import Path

from collector.blocks import readme as readme_block
from collector.blocks.classify import signals
from collector.blocks.classify.engine import Evidence, classify
from collector.core.taxonomy import load
from collector.lab.strategies import STRATEGIES

GOLD = Path(__file__).with_name("gold.json")
HOLDOUT = Path(__file__).with_name("holdout.json")
README_CACHE = Path(__file__).with_name(".readme-cache.json")  # git-ignored


def load_gold(path: Path = GOLD):
    return json.loads(path.read_text())


def readmes(gold) -> dict[str, str]:
    cache = json.loads(README_CACHE.read_text()) if README_CACHE.exists() else {}
    missing = [g["fullName"] for g in gold if g["fullName"] not in cache]
    if missing:
        cache.update(readme_block.fetch_readmes(missing))
        README_CACHE.write_text(json.dumps(cache, ensure_ascii=False))
    return cache


def score(strategy, gold, texts=None):
    tax = load()
    right = tagged = 0
    errors = []
    for g in gold:
        features = signals.readme_features(tax, texts[g["fullName"]]) if texts and g["fullName"] in texts else None
        out = classify(Evidence(g["fullName"], g["description"] if g["description"] != "无描述" else "", g["language"], topics=tuple(g.get("topics") or ()), readme=features), strategy, tax)
        want = tax.by_id(g["label"]).label
        right += out["category"] == want
        tagged += want in [out["category"], *out["tags"]]
        if out["category"] != want: errors.append((g["fullName"], want, out["category"], out["classification"]["reasons"][:2]))
    n = len(gold)
    return {"accuracy": right / n, "topTags": tagged / n, "errors": errors}


def main(readme: bool = False, errors: bool = False):
    sets = {"tuning (gold)": load_gold(GOLD), "holdout": load_gold(HOLDOUT)}
    texts = readmes(sets["tuning (gold)"] + sets["holdout"]) if readme else None
    results = {}
    for title, gold in sets.items():
        print(f"{title}: {len(gold)} repositories, {len(set(g['label'] for g in gold))} categories" + (", with README signals" if texts else ""))
        for name, strategy in STRATEGIES.items():
            results[(title, name)] = r = score(strategy, gold, texts)
            print(f"  {name:10} accuracy {r['accuracy']:.0%}   label in primary+tags {r['topTags']:.0%}")
    if errors:
        from collector.lab.strategies import DEFAULT
        r = results[("tuning (gold)", DEFAULT)]
        print(f"\nmisclassified by '{DEFAULT}' on the tuning set:")
        for name, want, got, why in r["errors"]: print(f"  {name:55} want {want:8} got {got:8} {why}")
        print("\nmost confused:", Counter((w, g) for _, w, g, _ in r["errors"]).most_common(5))
    return results
