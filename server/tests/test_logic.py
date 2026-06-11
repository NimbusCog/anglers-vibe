import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import economy
import species
import validate
import world


# ---- world ----
def test_phase_progression():
    assert world.phase_at(0.0) == "dawn"
    assert world.phase_at(0.3) == "day"
    assert world.phase_at(0.7) == "dusk"
    assert world.phase_at(0.9) == "night"


def test_game_time_advances():
    epoch = 1000
    d0, f0 = world.game_time(1000, epoch)
    d1, f1 = world.game_time(1000 + world.config.DAY_SECONDS + 60, epoch)
    assert d0 == 0
    assert d1 == 1


def test_weather_and_aurora_deterministic():
    assert world.weather_for_day(5, 42) == world.weather_for_day(5, 42)
    assert world.aurora_for_day(5, 42) == world.aurora_for_day(5, 42)


def test_snapshot_shape():
    snap = world.snapshot(2000, 0, 42)
    assert set(snap) >= {"day", "frac", "phase", "weather", "aurora", "sun_angle"}


# ---- species sampling ----
def test_region1_pool_excludes_other_regions():
    pool = species.pool_for_region(1, "day", "clear", False)
    ids = {sp["id"] for sp, _ in pool}
    assert ids == {1, 2, 3, 4, 5}


def test_king_salmon_only_dawn_dusk():
    assert species.bite_weight(species.BY_ID[10], "day", "clear", False) == 0
    assert species.bite_weight(species.BY_ID[10], "dawn", "clear", False) > 0


def test_aurora_king_needs_aurora():
    assert species.bite_weight(species.BY_ID[23], "night", "clear", False) == 0
    assert species.bite_weight(species.BY_ID[23], "night", "clear", True) > 0


def test_fog_boosts_pike():
    base = species.bite_weight(species.BY_ID[4], "day", "clear", False)
    fog = species.bite_weight(species.BY_ID[4], "day", "fog", False)
    assert fog > base


def test_sample_returns_valid_weight():
    rng = random.Random(1)
    for _ in range(50):
        res = species.sample_catch(1, "day", "clear", False, rng)
        assert res is not None
        sp, w, pct = res
        assert sp["wmin"] <= w <= sp["wmax"]
        assert 0 <= pct <= 1


# ---- validate ----
def _world(phase="day", weather="clear", aurora=False):
    return {"phase": phase, "weather": weather, "aurora": aurora}


def test_validate_accepts_legal_catch():
    ok, _ = validate.validate_catch(1, 2.0, 1, _world(), None, 1000)
    assert ok


def test_validate_rejects_wrong_region():
    ok, reason = validate.validate_catch(6, 3.0, 1, _world(), None, 1000)
    assert not ok and "region" in reason


def test_validate_rejects_bad_weight():
    ok, reason = validate.validate_catch(1, 99.0, 1, _world(), None, 1000)
    assert not ok and "weight" in reason


def test_validate_rejects_rapid_fire():
    ok, reason = validate.validate_catch(1, 2.0, 1, _world(), 995, 1000)
    assert not ok and "soon" in reason


def test_validate_rejects_out_of_conditions():
    ok, reason = validate.validate_catch(10, 10.0, 2, _world(phase="day"), None, 1000)
    assert not ok


# ---- economy ----
def test_first_catch_doubles():
    base = economy.catch_value(1, 0.5, False)
    first = economy.catch_value(1, 0.5, True)
    assert first == base * 2


def test_want_triples():
    base = economy.catch_value(1, 0.5, False)
    want = economy.catch_value(1, 0.5, False, want_species=1)
    assert want == base * 3


def test_bigger_fish_pays_more():
    assert economy.catch_value(1, 1.0, False) > economy.catch_value(1, 0.0, False)
