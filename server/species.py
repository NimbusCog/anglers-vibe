"""Fish species table (data-driven, from docs/design.md) + bite-pool sampling."""
import random

RARITY_WEIGHT = {"common": 100, "uncommon": 35, "rare": 8, "legendary": 1}

# Method multipliers by personality class — methods favor the fish that fit them.
# float = neutral baseline; spin excites predators; fly charms delicate river fish;
# jig provokes deep sulkers. Applied client-side in sampling, informational here.
METHOD_MULT = {
    "spin": {"ambush": 2.5, "runner": 2.0, "bulldog": 1.5, "sprinter": 1.3},
    "fly":  {"twitchy": 3.0, "sprinter": 2.0, "jumper": 1.5},
    "jig":  {"sulker": 3.0, "bulldog": 2.5, "panic": 2.0, "palelight": 2.0, "boss": 1.5},
}

# region: which regions this fish appears in. conditions: dict of multipliers.
#   time: {dawn,day,dusk,night}; weather: {clear,rain,fog,snow}; aurora: bool flag.
#   "only" keys are HARD gates (excluded entirely if unmet).
SPECIES = [
    {"id": 1,  "name": "Rainbow Trout",     "regions": [1, 2], "rarity": "common",    "wmin": 0.5, "wmax": 3,  "price": 8,   "personality": "sprinter", "cond": {}},
    {"id": 2,  "name": "Dolly Varden",      "regions": [1],    "rarity": "common",    "wmin": 0.5, "wmax": 4,  "price": 10,  "personality": "steady",   "cond": {}},
    {"id": 3,  "name": "Arctic Grayling",   "regions": [1],    "rarity": "uncommon",  "wmin": 0.3, "wmax": 1.5,"price": 18,  "personality": "twitchy",  "cond": {"time": {"day": 1.6}}},
    {"id": 4,  "name": "Northern Pike",     "regions": [1],    "rarity": "uncommon",  "wmin": 1,   "wmax": 12, "price": 25,  "personality": "ambush",   "cond": {"weather": {"fog": 2.5}}},
    {"id": 5,  "name": "Stray Sockeye",     "regions": [1],    "rarity": "rare",      "wmin": 2,   "wmax": 4,  "price": 40,  "personality": "runner",   "cond": {"time": {"dawn": 2, "dusk": 2}}},
    {"id": 6,  "name": "Sockeye Salmon",    "regions": [2],    "rarity": "common",    "wmin": 2,   "wmax": 4,  "price": 35,  "personality": "runner",   "cond": {}},
    {"id": 7,  "name": "Pink Salmon",       "regions": [2],    "rarity": "common",    "wmin": 1,   "wmax": 2.5,"price": 28,  "personality": "sprinter", "cond": {"time": {"day": 1.5}}},
    {"id": 8,  "name": "Coho Salmon",       "regions": [2],    "rarity": "uncommon",  "wmin": 3,   "wmax": 6,  "price": 55,  "personality": "jumper",   "cond": {"time": {"dusk": 2}}},
    {"id": 9,  "name": "Chum Salmon",       "regions": [2],    "rarity": "uncommon",  "wmin": 4,   "wmax": 8,  "price": 48,  "personality": "grinder",  "cond": {"weather": {"rain": 2.5}}},
    {"id": 10, "name": "King Salmon",       "regions": [2],    "rarity": "rare",      "wmin": 8,   "wmax": 25, "price": 120, "personality": "bulldog",  "cond": {"only_time": ["dawn", "dusk"]}},
    {"id": 11, "name": "Alpine Char",       "regions": [3],    "rarity": "common",    "wmin": 1,   "wmax": 3,  "price": 70,  "personality": "steady",   "cond": {}},
    {"id": 12, "name": "Cutthroat Trout",   "regions": [3],    "rarity": "uncommon",  "wmin": 1,   "wmax": 3,  "price": 85,  "personality": "sprinter", "cond": {"time": {"dawn": 2}}},
    {"id": 13, "name": "Golden Dolly",      "regions": [3],    "rarity": "uncommon",  "wmin": 1,   "wmax": 4,  "price": 110, "personality": "twitchy",  "cond": {"weather": {"clear": 2}}},
    {"id": 14, "name": "Thunderbird Trout", "regions": [3],    "rarity": "rare",      "wmin": 3,   "wmax": 7,  "price": 200, "personality": "jumper",   "cond": {"only_weather": ["rain"]}},
    {"id": 15, "name": "Burbot",            "regions": [4],    "rarity": "common",    "wmin": 2,   "wmax": 6,  "price": 90,  "personality": "sulker",   "cond": {}},
    {"id": 16, "name": "Cave Char",         "regions": [4],    "rarity": "uncommon",  "wmin": 1,   "wmax": 4,  "price": 160, "personality": "panic",    "cond": {}},
    {"id": 17, "name": "Ghost Grayling",    "regions": [4],    "rarity": "rare",      "wmin": 0.5, "wmax": 2,  "price": 260, "personality": "twitchy",  "cond": {"time": {"night": 2}}},
    {"id": 18, "name": "The Pale One",      "regions": [4],    "rarity": "legendary", "wmin": 15,  "wmax": 40, "price": 500, "personality": "palelight","cond": {"only_time": ["night"]}},
    {"id": 19, "name": "Arctic Cod",        "regions": [5],    "rarity": "common",    "wmin": 1,   "wmax": 3,  "price": 180, "personality": "steady",   "cond": {}},
    {"id": 20, "name": "Lake Trout",        "regions": [5],    "rarity": "common",    "wmin": 5,   "wmax": 20, "price": 250, "personality": "bulldog",  "cond": {}},
    {"id": 21, "name": "Sheefish",          "regions": [5],    "rarity": "uncommon",  "wmin": 6,   "wmax": 15, "price": 300, "personality": "jumper",   "cond": {"time": {"dawn": 2, "dusk": 2}}},
    {"id": 22, "name": "Glacier Char",      "regions": [5],    "rarity": "uncommon",  "wmin": 3,   "wmax": 8,  "price": 270, "personality": "panic",    "cond": {"weather": {"snow": 2.5}}},
    {"id": 23, "name": "Aurora King",       "regions": [5],    "rarity": "legendary", "wmin": 20,  "wmax": 50, "price": 1200,"personality": "aurora",   "cond": {"only_aurora": True}},
    {"id": 24, "name": "Old Tern",          "regions": [5],    "rarity": "legendary", "wmin": 30,  "wmax": 60, "price": 2000,"personality": "boss",     "cond": {"only_time": ["night"], "only_weather": ["snow"]}},
]

BY_ID = {s["id"]: s for s in SPECIES}


def _passes_hard_gates(sp, time_phase, weather, aurora):
    c = sp["cond"]
    if "only_time" in c and time_phase not in c["only_time"]:
        return False
    if "only_weather" in c and weather not in c["only_weather"]:
        return False
    if c.get("only_aurora") and not aurora:
        return False
    return True


def bite_weight(sp, time_phase, weather, aurora, lure_mult=1.0):
    """Effective sampling weight for a species under current conditions (0 if hard-gated out)."""
    if not _passes_hard_gates(sp, time_phase, weather, aurora):
        return 0.0
    w = RARITY_WEIGHT[sp["rarity"]]
    c = sp["cond"]
    w *= c.get("time", {}).get(time_phase, 1.0)
    w *= c.get("weather", {}).get(weather, 1.0)
    return w * lure_mult


def pool_for_region(region, time_phase, weather, aurora):
    return [(sp, bite_weight(sp, time_phase, weather, aurora))
            for sp in SPECIES if region in sp["regions"]]


def sample_catch(region, time_phase, weather, aurora, rng=None):
    """Pick a species (weighted) and roll a weight. Returns (species, weight_kg, percentile) or None."""
    rng = rng or random
    pool = [(sp, w) for sp, w in pool_for_region(region, time_phase, weather, aurora) if w > 0]
    if not pool:
        return None
    total = sum(w for _, w in pool)
    r = rng.random() * total
    acc = 0.0
    chosen = pool[-1][0]
    for sp, w in pool:
        acc += w
        if r <= acc:
            chosen = sp
            break
    pct = rng.random()
    weight = round(chosen["wmin"] + pct * (chosen["wmax"] - chosen["wmin"]), 2)
    return chosen, weight, pct
