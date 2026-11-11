"""Command line: `python -m collector [run|classify|evaluate]`. The scheduled workflow calls `run`."""
import argparse
import logging
from collections import Counter
from datetime import datetime, timedelta

from collector.app import config, log as logs, store
from collector.blocks import history
from collector.core.settings import ROOT, TZ
from collector.lab import pipeline, strategies

log = logging.getLogger("collector")


def options(cfg: config.Config) -> pipeline.Options:
    return pipeline.Options(token=cfg.token, llm=cfg.llm, translation=cfg.translation, mymemory_email=cfg.mymemory_email, readme=cfg.readme, strategy=strategies.get(cfg.strategy))


def run(cfg: config.Config, sources: pipeline.Sources | None = None):
    timings: dict = {}
    data = cfg.data_dir
    now = datetime.now(TZ)
    previous = store.read_json(data / "latest.json", {})
    # Compare to the previous calendar day, not another run from the same day.
    baseline = store.read_json(data / "history" / f"{(now - timedelta(days=1)).date().isoformat()}.json", {})
    caches = store.load_caches(data, ROOT / "collector/editorial.json")
    with logs.timed(log, "collect", timings):
        snapshot = pipeline.collect(previous, baseline, caches, sources or pipeline.Sources(), options(cfg), now)
    with logs.timed(log, "history", timings):
        annotate_history(snapshot, data, now.date())
    with logs.timed(log, "publish", timings):
        store.publish(data, snapshot, caches)
    report(snapshot, timings)
    return snapshot


def annotate_history(snapshot: dict, data, today):
    """Star growth for every row (against earlier snapshots) and the first day each repo was listed."""
    days = [d for d in store.read_json(data / "dates.json", []) if d < today.isoformat()]
    picks = {p: history.pick_past(today, p, days) for p in history.WINDOW}
    wanted = {pick[0] for pick in picks.values() if pick}
    past = {d: history.stars_by_repo(store.read_json(data / "history" / f"{d}.json", {})) for d in wanted}
    history.add_star_deltas(snapshot["periods"], past, picks)
    index = store.read_json(data / store.FIRST_SEEN, None)
    if index is None:
        index = history.build_first_seen({d: store.read_json(data / "history" / f"{d}.json", {}) for d in days})
    store.atomic_json(data / store.FIRST_SEEN, history.update_first_seen(index, snapshot["periods"], snapshot["date"]))


def classify_only(cfg: config.Config):
    """Re-classify the latest snapshot with the current taxonomy and strategy, no ranking fetch."""
    data = cfg.data_dir
    snapshot = store.read_json(data / "latest.json", None)
    if not snapshot: raise SystemExit("no latest.json to classify")
    caches = store.load_caches(data, ROOT / "collector/editorial.json")
    opt = options(cfg)
    unique = {r["fullName"]: r for rows in snapshot["periods"].values() for r in rows}
    pipeline.gather_features(unique, caches["features"], pipeline.Sources(), opt, datetime.now(TZ))
    pipeline.reclassify(snapshot, caches, opt.strategy)
    store.atomic_json(data / "latest.json", snapshot)
    store.atomic_json(data / "history" / f"{snapshot['date']}.json", snapshot)
    store.atomic_json(data / store.CACHES["features"], caches["features"])
    report(snapshot, {})


def report(snapshot: dict, timings: dict):
    unique = {r["fullName"]: r for rows in snapshot["periods"].values() for r in rows}
    logs.summary(periodCounts={k: len(v) for k, v in snapshot["periods"].items()}, enrichment=snapshot.get("enrichment"), classifier=snapshot.get("classifier"), categories=dict(Counter(r["category"] for r in unique.values()).most_common()), timings=timings)


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m collector", description="GIT Bot collector")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("run", help="collect, enrich, classify and publish (default)")
    sub.add_parser("classify", help="re-classify the latest snapshot without fetching rankings")
    ev = sub.add_parser("evaluate", help="score classifier strategies on the labelled set")
    ev.add_argument("--readme", action="store_true", help="also fetch READMEs (network) for the readme signal")
    ev.add_argument("--errors", action="store_true", help="list misclassified repositories")
    args = parser.parse_args(argv)
    cfg = config.from_env()
    logs.setup(cfg.log_level)
    if args.command == "classify": classify_only(cfg)
    elif args.command == "evaluate":
        from collector.lab import evaluate
        evaluate.main(readme=args.readme, errors=args.errors)
    else: run(cfg)
