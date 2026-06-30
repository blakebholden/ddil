"""markings.py — deterministic fictional DLS markings for the PMC corpus.

Assigns a classification + compartments + caveats to each document by hashing
its parent_id, so the same paper always gets the same markings and every chunk
+ figure of a paper shares one marking. The field names match what the backend
DLS filter queries (app/services/jina_dls.py): classification, compartments,
compartments_count, caveats, releasability, source_type.
"""

from __future__ import annotations

import hashlib

CLS_HIER = ["U", "CUI", "C", "S", "TS"]
COMPARTMENTS = ["SCI", "HCS", "SI", "TK"]
SRC_TYPES = ["OSINT", "IMINT", "HUMINT", "SIGINT"]


def _h(parent_id: str, salt: str) -> int:
    return int(hashlib.md5(f"{salt}:{parent_id}".encode()).hexdigest(), 16)


def assign_markings(parent_id: str) -> dict:
    # classification distribution: U 40 / CUI 25 / C 15 / S 13 / TS 7
    r = _h(parent_id, "cls") % 100
    if r < 40:
        cls = "U"
    elif r < 65:
        cls = "CUI"
    elif r < 80:
        cls = "C"
    elif r < 93:
        cls = "S"
    else:
        cls = "TS"

    comps: list[str] = []
    if cls in ("S", "TS"):
        bits = _h(parent_id, "comp")
        chosen = [c for i, c in enumerate(COMPARTMENTS) if (bits >> i) & 1]
        if not chosen:
            chosen = [COMPARTMENTS[bits % len(COMPARTMENTS)]]
        cap = 2 if cls == "S" else 3
        comps = chosen[:cap]

    caveats: list[str] = []
    if cls in ("C", "S", "TS") and _h(parent_id, "noforn") % 100 < 45:
        caveats.append("NOFORN")
    if cls == "TS" and _h(parent_id, "orcon") % 100 < 25:
        caveats.append("ORCON")

    if "NOFORN" in caveats:
        rel = ["USA"]
    else:
        rel = ["USA", "FVEY"] if _h(parent_id, "rel") % 100 < 40 else ["USA"]

    src = SRC_TYPES[_h(parent_id, "src") % len(SRC_TYPES)]

    return {
        "classification": cls,
        "compartments": comps,
        "compartments_count": len(comps),
        "caveats": caveats,
        "releasability": rel,
        "source_type": src,
    }
