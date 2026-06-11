"""Server-owned world clock, weather, and aurora — deterministic from epoch + seed."""
import math

import config

PHASES = ["dawn", "day", "dusk", "night"]
WEATHERS = ["clear", "rain", "fog", "snow"]


def game_time(now, clock_epoch):
    """Returns (day_number, fraction_of_day 0..1)."""
    elapsed = max(0.0, now - clock_epoch)
    days = elapsed / config.DAY_SECONDS
    return int(days), days - int(days)


def phase_at(frac):
    """Day fraction -> phase. dawn 0-0.15, day 0.15-0.6, dusk 0.6-0.75, night 0.75-1."""
    if frac < 0.15:
        return "dawn"
    if frac < 0.6:
        return "day"
    if frac < 0.75:
        return "dusk"
    return "night"


def _hash(*ints):
    h = 2166136261
    for v in ints:
        h = ((h ^ (int(v) & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    return h


def weather_for_day(day, seed):
    """One weather per game day, deterministic. Snow only conceptually at altitude (region 5)."""
    return WEATHERS[_hash(seed, day, 7) % len(WEATHERS)]


def aurora_for_day(day, seed):
    """Aurora appears some clear nights — ~1 in 3 days, only meaningful at night."""
    return (_hash(seed, day, 99) % 3) == 0


def snapshot(now, clock_epoch, seed):
    """Full world state for /api/state and WS pushes."""
    day, frac = game_time(now, clock_epoch)
    phase = phase_at(frac)
    weather = weather_for_day(day, seed)
    aurora = aurora_for_day(day, seed) and phase == "night"
    return {
        "day": day,
        "frac": round(frac, 4),
        "phase": phase,
        "weather": weather,
        "aurora": aurora,
        "sun_angle": round(math.sin(frac * 2 * math.pi), 4),
    }
