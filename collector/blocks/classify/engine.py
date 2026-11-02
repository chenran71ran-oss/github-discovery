"""Combines signals with strategy weights into a primary category, secondary tags and evidence."""
from dataclasses import dataclass, field

from collector.blocks.classify import signals
from collector.core.taxonomy import Taxonomy, load
from collector.core.types import Classification

# When scores tie, prefer the more specific field: everyday-life and tool categories first,
# the broad AI category last ("AI-powered note app" is a note app).
TIE_FIRST = ("finance", "health", "games", "smarthome", "lifestyle", "entertainment", "social", "media", "browser", "selfhosted", "automation", "productivity", "cli", "security", "gamedev", "research", "learning", "apps", "frontend", "backend", "data", "devtools", "ai")


@dataclass(frozen=True)
class Strategy:
    name: str
    weights: dict[str, float]  # signal name -> weight; missing or 0 disables the signal
    bias: dict[str, float] = field(default_factory=dict)  # category id -> multiplier
    facet_bias: dict[str, float] = field(default_factory=dict)  # facet -> multiplier, e.g. {"tech": 0.6}
    tag_ratio: float = 0.6  # a secondary tag needs at least this share of the winner's score
    max_tags: int = 2
    min_score: float = 1.5  # below this the repository is "其他"
    cap: float = 99  # diminishing returns: at most this many distinct hits count per signal and category


@dataclass
class Evidence:
    full_name: str
    description: str = ""
    language: str = ""
    summary: str = ""  # Chinese summary, if any: adds Chinese keyword hits
    topics: tuple[str, ...] = ()
    readme: dict | None = None  # signals.readme_features output
    model_label: str | None = None


def collect_signals(tax: Taxonomy, ev: Evidence, s: Strategy) -> dict[str, signals.Scores]:
    text = f"{signals.name_text(ev.full_name)} {ev.description} {ev.summary or ''}"
    stack_labels = signals.detect(tax.stacks, f"{text} {' '.join(ev.topics)}", (ev.readme or {}).get("stacks", []))
    available = {
        "keywords": lambda: signals.keywords(tax, text),
        "topics": lambda: signals.topics(tax, ev.topics),
        "readme": lambda: signals.readme(tax, (ev.readme or {}).get("hits")),
        "language": lambda: signals.language(tax, ev.language),
        "stacks": lambda: signals.stacks(stack_labels),
        "model": lambda: signals.model(tax, ev.model_label),
    }
    return {name: available[name]() for name, w in s.weights.items() if w and name in available}


def classify(ev: Evidence, s: Strategy, tax: Taxonomy | None = None) -> dict:
    tax = tax or load()
    totals: dict[str, float] = {}
    reasons: dict[str, list[tuple[float, str]]] = {}
    for name, scores in collect_signals(tax, ev, s).items():
        for cid, (score, why) in scores.items():
            value = min(score, s.cap) * s.weights[name] * s.bias.get(cid, 1.0) * s.facet_bias.get(tax.by_id(cid).facet, 1.0)
            totals[cid] = totals.get(cid, 0.0) + value
            reasons.setdefault(cid, []).extend((s.weights[name], w) for w in why)
    order = {cid: i for i, cid in enumerate(TIE_FIRST)}
    ranked = sorted(totals.items(), key=lambda kv: (-round(kv[1], 6), order.get(kv[0], len(order))))
    text = f"{signals.name_text(ev.full_name)} {ev.description} {ev.summary or ''} {' '.join(ev.topics)}"
    purposes = signals.detect(tax.purposes, text)[:4]
    techstack = signals.detect(tax.stacks, text, (ev.readme or {}).get("stacks", []))[:6]
    if not ranked or ranked[0][1] < s.min_score:
        top = tax.fallback
        return {"category": top.label, "tags": [], "domain": top.domain, "purposes": purposes, "techStack": techstack, "classification": Classification(by="rules", strategy=s.name, confidence=0.0, reasons=["证据不足，归入其他"])}
    best, best_score = ranked[0]
    total = sum(v for _, v in ranked)
    tags = [tax.by_id(cid).label for cid, v in ranked[1:] if v >= best_score * s.tag_ratio][: s.max_tags]
    why = [w for _, w in sorted(reasons[best], key=lambda r: -r[0])]
    top = tax.by_id(best)
    by = "ai" if ev.model_label and tax.by_label(ev.model_label).id == best and s.weights.get("model") else "rules"
    return {"category": top.label, "tags": tags, "domain": top.domain, "purposes": purposes, "techStack": techstack, "classification": Classification(by=by, strategy=s.name, confidence=round(best_score / total, 2), reasons=list(dict.fromkeys(why))[:4])}
