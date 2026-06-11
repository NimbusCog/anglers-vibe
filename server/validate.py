"""Catch plausibility — the server's anti-cheat gate."""
import config
import species


def validate_catch(species_id, weight, region, world, last_catch_ts, now):
    """Returns (ok, reason). Rejects illegal species, impossible weight, and rapid-fire."""
    sp = species.BY_ID.get(species_id)
    if sp is None:
        return False, "unknown species"
    if region not in sp["regions"]:
        return False, "species not in region"
    if weight < sp["wmin"] - 0.01 or weight > sp["wmax"] + 0.01:
        return False, "weight out of range"
    if species.bite_weight(sp, world["phase"], world["weather"], world["aurora"]) <= 0:
        return False, "species not biting under current conditions"
    if last_catch_ts is not None and now - last_catch_ts < config.MIN_CATCH_INTERVAL:
        return False, "too soon since last catch"
    return True, "ok"
