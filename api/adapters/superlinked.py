"""Superlinked SIE — filter-preserving rerank.

Live: hard rules still decide the groups (e.g. chairs that pass every fit check stay above
chairs that don't); SIE's reranker orders items *within* each group by how well they match
the person's needs. Same idea as the cookbook's ecommerce/rerank_search_within_filters.

Mock: the caller's local sort key, unchanged.
"""
from __future__ import annotations

from typing import Callable, Optional

from . import sie
from .base import sponsor_call, TIMEOUT_S

SPONSOR = "superlinked"


def status() -> str:
    return "live" if sie.enabled() else "mock"


async def rank(
    op: str,
    items: list,
    key: Callable[[object], object],
    *,
    query: Optional[str] = None,
    text: Optional[Callable[[object], str]] = None,
    group: Optional[Callable[[object], object]] = None,
    item_id: Optional[Callable[[object], str]] = None,
    instruction: Optional[str] = None,
) -> list:
    """Sort `items`. With SIE live and a query given, rerank within `group` buckets."""
    local = lambda: sorted(items, key=key)  # noqa: E731
    live = None
    if sie.enabled() and query and text and items:
        ident = item_id or (lambda it: str(it["id"]))  # type: ignore[index]
        grp = group or (lambda it: 0)

        async def live():  # noqa: F811
            scores = await sie.score(query, [(ident(it), text(it)) for it in items], instruction, TIMEOUT_S)
            out = sorted(items, key=lambda it: (grp(it), -scores.get(ident(it), 0.0), key(it)))
            for it in out:
                if isinstance(it, dict):
                    it["relevance"] = round(scores.get(ident(it), 0.0), 4)
            return out

    value, _ = await sponsor_call(SPONSOR, f"rank.{op}", live, local)
    return value
