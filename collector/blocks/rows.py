"""Builds the uniform ranking row every fetcher returns."""
from collector.core.settings import NO_DESCRIPTION
from collector.core.types import Repo


def new_row(full_name: str, description: str, language: str, stars: int, forks: int, origin: str, **extra) -> Repo:
    row: Repo = {"fullName": full_name, "rank": 0, "description": description or NO_DESCRIPTION, "language": language or "未知", "stars": stars, "forks": forks, "periodStars": None, "previousRank": None, "summary": None, "useCase": None, "techStack": [], "highlights": [], "category": "其他", "summarySource": "pending", "summaryAt": None, "origin": origin}
    row.update(extra)
    return row
