"""Command line: `python -m collector [run|classify|evaluate]`. The scheduled workflow calls `run`."""
import argparse
import json
import logging
from collections import Counter
from datetime import datetime, timedelta

from collector.app import config, log as logs, store
from collector.blocks import history, models
from collector.core.settings import ROOT, TZ
from collector.lab import pipeline, strategies

log = logging.getLogger("collector")


def options(cfg: config.Config) -> pipeline.Options:
    base, key, model, max_requests = cfg.ai
    return pipeline.Options(token=cfg.token, llm=cfg.llm, models=models.Provider(base, key, model), models_max=max_requests, translation=cfg.translation, mymemory_email=cfg.mymemory_email, readme=cfg.readme, strategy=strategies.get(cfg.strategy))


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
    # 详情里的趋势小图：最近 14 份快照（含今天）里每个项目的总 Star 与日榜名次
    recent = {d: store.read_json(data / "history" / f"{d}.json", {}) for d in sorted(days)[-13:]}
    recent[snapshot["date"]] = snapshot
    names = {r["fullName"] for rows in snapshot["periods"].values() for r in rows}
    store.atomic_json(data / store.TRENDS, history.build_trends(recent, names), compact=True)


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


def probe_models(cfg: config.Config, count: int = 10):
    """Trial run: list the models the key can use, then send one batch of today's machine-translated projects and
    print the answers next to what the site shows now. Writes nothing; used from the workflow's probe mode."""
    from collector.core.taxonomy import load
    base, key, model, _ = cfg.ai
    if not key: raise SystemExit("AI_API_KEY is not set")
    provider = models.Provider(base, key, model)
    with models.new_session() as session:
        r = session.get(base.rstrip("/") + "/models", headers={"Authorization": f"Bearer {key}"}, timeout=30)
        try: ids = [m.get("id") for m in r.json().get("data", [])]
        except ValueError: ids = []
        print(json.dumps({"check": "models", "status": r.status_code, "count": len(ids), "hasModel": any(i.split("/")[-1] == model for i in ids if i), "flash": [i for i in ids if i and "flash" in i][:12]}, ensure_ascii=False))
        snapshot = store.read_json(cfg.data_dir / "latest.json", {})
        rows = [r for r in snapshot.get("periods", {}).get("daily", []) if r.get("summarySource") in ("machine", "pending")][:count]
        projects = [{"id": i, "name": r["fullName"], "description": r["description"][:400], "topics": (r.get("topics") or [])[:8], "language": r.get("language", "")} for i, r in enumerate(rows)]
        try: items = models.request(session, provider, projects)
        except models.Stop as stop: raise SystemExit(f"probe failed: {stop}") from stop
    labels = set(load().labels)
    by_id = {it.get("id"): it for it in items if isinstance(it, dict)}
    ok = 0
    for i, r in enumerate(rows):
        it = by_id.get(i) or {}
        good = models.valid(it, labels)
        ok += good
        print(json.dumps({"repo": r["fullName"], "en": r["description"][:120], "now": r.get("summary"), "nowCategory": r.get("category"),
                          "ai": models.polish(it.get("summary", ""), r["description"]) if good else it, "aiCategory": it.get("category"), "valid": good}, ensure_ascii=False))
    print(json.dumps({"model": model, "sent": len(rows), "valid": ok}, ensure_ascii=False))
    if not ok: raise SystemExit("probe returned no valid answers")


def main(argv=None):
    parser = argparse.ArgumentParser(prog="python -m collector", description="GIT Bot collector")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("run", help="collect, enrich, classify and publish (default)")
    sub.add_parser("classify", help="re-classify the latest snapshot without fetching rankings")
    sub.add_parser("probe-models", help="trial: list models, then one AI batch on today's machine-translated rows; prints results, writes nothing")
    ev = sub.add_parser("evaluate", help="score classifier strategies on the labelled set")
    ev.add_argument("--readme", action="store_true", help="also fetch READMEs (network) for the readme signal")
    ev.add_argument("--errors", action="store_true", help="list misclassified repositories")
    args = parser.parse_args(argv)
    cfg = config.from_env()
    logs.setup(cfg.log_level)
    if args.command == "classify": classify_only(cfg)
    elif args.command == "probe-models": probe_models(cfg)
    elif args.command == "evaluate":
        from collector.lab import evaluate
        evaluate.main(readme=args.readme, errors=args.errors)
    else: run(cfg)
