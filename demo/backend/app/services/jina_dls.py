"""Document-level security model for the Jina "Need-to-Know" demo.

Ported faithfully from the source demo's markings.py. Defines the clearance
hierarchy, the four analyst personas, and the ES filter that enforces
need-to-know: an analyst sees a document only if (a) its classification is at or
below their clearance, (b) it carries no compartments OR the analyst holds ALL of
them (subset rule), and (c) NOFORN docs are hidden unless the analyst is
NOFORN-cleared (a US person).
"""

from __future__ import annotations

CLS_HIER = ["U", "CUI", "C", "S", "TS"]
CLS_ORDER = {c: i for i, c in enumerate(CLS_HIER)}
COMPARTMENTS = ["SCI", "HCS", "SI", "TK"]

# Canonical persona definitions (mirror markings.py ANALYSTS + UI labels).
ANALYSTS: dict[str, dict] = {
    "public": {
        "id": "public", "name": "Public User", "clearance": "U",
        "compartments": [], "noforn": False,
        "label": "U · no compartments · foreign",
    },
    "secret_si": {
        "id": "secret_si", "name": "Analyst A", "clearance": "S",
        "compartments": ["SI"], "noforn": True,
        "label": "SECRET · SI · US",
    },
    "ts_hcs": {
        "id": "ts_hcs", "name": "Analyst B", "clearance": "TS",
        "compartments": ["SCI", "HCS", "SI"], "noforn": True,
        "label": "TS/SCI · HCS · SI · US",
    },
    "ts_all": {
        "id": "ts_all", "name": "Senior Analyst", "clearance": "TS",
        "compartments": ["SCI", "HCS", "TK", "SI"], "noforn": True,
        "label": "TS/SCI · HCS · TK · SI · US",
    },
}

DEFAULT_ANALYST = "public"


def get_analyst(analyst_id: str | None) -> dict:
    return ANALYSTS.get(analyst_id or DEFAULT_ANALYST, ANALYSTS[DEFAULT_ANALYST])


def allowed_levels(clearance: str) -> list[str]:
    return CLS_HIER[: CLS_ORDER.get(clearance, 0) + 1]


def dls_filter(analyst: dict) -> tuple[list[dict], list[dict]]:
    """Return (filter_clauses, must_not_clauses) enforcing need-to-know."""
    clauses: list[dict] = [
        {"terms": {"classification": allowed_levels(analyst["clearance"])}},
        {
            "bool": {
                "minimum_should_match": 1,
                "should": [
                    {"bool": {"must_not": {"exists": {"field": "compartments"}}}},
                    {
                        "terms_set": {
                            "compartments": {
                                "terms": analyst["compartments"] or ["__none__"],
                                "minimum_should_match_field": "compartments_count",
                            }
                        }
                    },
                ],
            }
        },
    ]
    must_not: list[dict] = [] if analyst.get("noforn") else [{"term": {"caveats": "NOFORN"}}]
    return clauses, must_not


def dls_bool(analyst: dict) -> dict:
    """The DLS pre-filter as a single bool query (for retriever.filter / agg query)."""
    clauses, must_not = dls_filter(analyst)
    return {"bool": {"filter": clauses, "must_not": must_not}}
