"""Pricing and the shop catalog."""
import species

# id -> (label, price, kind). kind: gear (unlocks/equipment) | creel (slot upgrade) | rod/reel/line tiers.
CATALOG = {
    "waders":   {"label": "Waders",          "price": 300,  "kind": "gear"},
    "rope":     {"label": "Climbing Rope",   "price": 900,  "kind": "gear"},
    "lantern":  {"label": "Lantern",         "price": 2200, "kind": "gear"},
    "parka":    {"label": "Parka",           "price": 4500, "kind": "gear"},
    "rod2":     {"label": "Fiberglass Rod",  "price": 250,  "kind": "rod",  "tier": 2},
    "rod3":     {"label": "Carbon Rod",      "price": 1200, "kind": "rod",  "tier": 3},
    "rod4":     {"label": "Legend Rod",      "price": 3000, "kind": "rod",  "tier": 4},
    "reel2":    {"label": "Smooth Reel",     "price": 200,  "kind": "reel", "tier": 2},
    "reel3":    {"label": "Precision Reel",  "price": 900,  "kind": "reel", "tier": 3},
    "reel4":    {"label": "Glacier Reel",    "price": 2500, "kind": "reel", "tier": 4},
    "line2":    {"label": "Braided Line",    "price": 150,  "kind": "line", "tier": 2},
    "line3":    {"label": "Fluoro Line",     "price": 700,  "kind": "line", "tier": 3},
    "line4":    {"label": "Steelweave Line", "price": 1800, "kind": "line", "tier": 4},
    "creel8":   {"label": "Creel +2 (8)",    "price": 150,  "kind": "creel", "slots": 8},
    "creel10":  {"label": "Creel +2 (10)",   "price": 400,  "kind": "creel", "slots": 10},
}


def catch_value(species_id, percentile, first_catch, want_species=None):
    """$ for a fish. base × (0.6 + 0.8×percentile), ×2 first-of-species, ×3 daily want."""
    sp = species.BY_ID[species_id]
    v = sp["price"] * (0.6 + 0.8 * percentile)
    if first_catch:
        v *= 2
    if want_species == species_id:
        v *= 3
    return round(v)
