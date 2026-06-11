"""Economy curve simulation — verifies a fresh save can reach The Eye in a few hours
of efficient play and that no gate causes a stall (M3 exit test, automated half)."""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import economy
import species

# seconds per catch cycle: bite wait mean 16.5 + fight ~20 + recast/walk overhead ~15
CYCLE_S = 52
# best fishable region per gear state
GATE_ORDER = ["waders", "rod2", "reel2", "line2", "rope", "rod3", "lantern", "reel3", "line3", "parka", "rod4"]


def region_for(gear):
    if "parka" in gear and "rope" in gear:
        return 5
    if "lantern" in gear:
        return 4
    if "rope" in gear:
        return 3
    if "waders" in gear:
        return 2
    return 1


def expected_value_per_catch(region, rng):
    """Monte-carlo mean $ per catch in a region across a spread of day conditions."""
    total, n = 0, 0
    for phase in ["dawn", "day", "dusk", "night"]:
        for weather in ["clear", "rain", "fog"]:
            for _ in range(40):
                res = species.sample_catch(region, phase, weather, False, rng)
                if res is None:
                    continue
                sp, w, pct = res
                total += economy.catch_value(sp["id"], pct, False)
                n += 1
    return total / max(n, 1)


def test_curve_reaches_the_eye_within_hours():
    rng = random.Random(7)
    money, gear, hours = 20, set(), 0.0
    for target in GATE_ORDER:
        price = economy.CATALOG[target]["price"]
        region = region_for(gear)
        ev = expected_value_per_catch(region, rng)
        assert ev > 0, f"region {region} yields nothing"
        catches_needed = max(0, (price - money)) / ev
        hours += catches_needed * CYCLE_S / 3600
        money = max(0, money - price)  # spent; surplus carried via money calc below
        money += 0  # money after purchase resets to leftover, approximated as 0
        gear.add(target)
        assert hours < 12, f"stalled before {target}: {hours:.1f}h already"
    # full kit including parka: The Eye unlocked
    assert region_for(gear) == 5
    # spec: "a few hours" — efficient play should land between 2 and 9 hours
    assert 1.5 < hours < 9, f"curve out of band: {hours:.1f}h"


def test_each_gate_step_under_45_minutes():
    """No single gate should demand more than ~45 min of grinding at the best water."""
    rng = random.Random(11)
    money, gear = 20, set()
    for target in GATE_ORDER:
        price = economy.CATALOG[target]["price"]
        ev = expected_value_per_catch(region_for(gear), rng)
        step_hours = max(0, price - money) / ev * CYCLE_S / 3600
        assert step_hours < 0.75, f"{target} takes {step_hours:.2f}h of grind"
        money = 0
        gear.add(target)
